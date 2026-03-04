import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Bot, UserCheck, Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface SwapSessionDialogProps {
  session: {
    id: string;
    session_name: string;
    discipline: string;
    duration_min?: number | null;
    workout_details?: string | null;
    week_number: number;
    day_of_week: number;
  };
}

type Step = 'reason' | 'method' | 'ai_result' | 'coach_sent';

export function SwapSessionDialog({ session }: SwapSessionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState('no_equipment');
  const [reasonDetails, setReasonDetails] = useState('');
  const [method, setMethod] = useState<'ai' | 'coach'>('ai');
  const [loading, setLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    name: string;
    discipline: string;
    duration: number | null;
    details: string;
    notes: string;
  } | null>(null);

  const reset = () => {
    setStep('reason');
    setReason('no_equipment');
    setReasonDetails('');
    setMethod('ai');
    setAiResult(null);
    setLoading(false);
  };

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) reset();
  };

  const reasonLabel = reason === 'no_equipment'
    ? 'Equipment unavailable'
    : reason === 'less_time'
      ? 'Less time available'
      : 'Other reason';

  const handleGenerateAI = async () => {
    setLoading(true);
    try {
      const prompt = `I need a SINGLE substitute session for today. 
Original session: "${session.session_name}" (${session.discipline}, ${session.duration_min || '?'} min).
Workout details: ${session.workout_details || 'N/A'}
Reason for swap: ${reasonLabel}. ${reasonDetails ? `Details: ${reasonDetails}` : ''}

Requirements:
- Must target similar training stimulus
- ${reason === 'no_equipment' ? 'Use ONLY bodyweight or minimal equipment' : ''}
- ${reason === 'less_time' ? 'Keep it under 30 minutes' : ''}
- Give me the substitute in this EXACT format:

**Session Name:** [name]
**Discipline:** [one of: run, bike, strength, mobility, custom]
**Duration:** [minutes]
**Workout:**
[detailed workout description]
**Coach Note:** [brief explanation of why this is equivalent]`;

      // Use fetch directly to get the streaming response
      const session_token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!session_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hyrox-ai-coach`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
        }
      );

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      let fullText = '';
      const reader = response.body?.getReader();
      if (reader) {
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) fullText += delta;
            } catch { /* skip */ }
          }
        }
      }

      // Parse the structured response (handle ** and ## formats)
      const nameMatch = fullText.match(/\*\*Session Name:?\*\*\s*(.+?)(?:\n|$)/) 
        || fullText.match(/##\s*Session Name:?\s*(.+?)(?:\n|$)/);
      const discMatch = fullText.match(/\*\*Discipline:?\*\*\s*(.+?)(?:\n|$)/)
        || fullText.match(/##\s*Discipline:?\s*(.+?)(?:\n|$)/);
      const durMatch = fullText.match(/\*\*Duration:?\*\*\s*(\d+)/)
        || fullText.match(/Duration:?\s*(\d+)/);
      const workoutMatch = fullText.match(/\*\*Workout:?\*\*\s*([\s\S]*?)(?:\*\*Coach Note|$)/)
        || fullText.match(/##\s*Workout:?\s*([\s\S]*?)(?:##\s*Coach Note|\*\*Coach Note|$)/);
      const noteMatch = fullText.match(/\*\*Coach Note:?\*\*\s*([\s\S]*?)$/)
        || fullText.match(/##\s*Coach Note:?\s*([\s\S]*?)$/);

      // Clean discipline string (remove markdown artifacts)
      const rawDisc = discMatch?.[1]?.trim().toLowerCase().replace(/\*+/g, '') || 'custom';
      const validDisciplines = ['run', 'bike', 'strength', 'mobility', 'custom'];
      const discipline = validDisciplines.find(d => rawDisc.includes(d)) || 'custom';

      setAiResult({
        name: nameMatch?.[1]?.trim().replace(/\*+/g, '') || 'Alternative Session',
        discipline,
        duration: durMatch?.[1] ? parseInt(durMatch[1]) : session.duration_min || null,
        details: workoutMatch?.[1]?.trim() || fullText,
        notes: noteMatch?.[1]?.trim() || '',
      });
      setStep('ai_result');
    } catch (e) {
      toast.error('Failed to generate alternative. Try again or request from coach.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptAI = async () => {
    if (!user || !aiResult) return;
    setLoading(true);
    const { error } = await supabase.from('session_substitutions' as any).insert({
      athlete_id: user.id,
      original_session_id: session.id,
      reason,
      reason_details: reasonDetails || null,
      source: 'ai',
      status: 'active',
      substitute_session_name: aiResult.name,
      substitute_discipline: aiResult.discipline,
      substitute_duration_min: aiResult.duration,
      substitute_workout_details: aiResult.details,
      substitute_notes: aiResult.notes,
    });
    setLoading(false);
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Session swapped! 🔄');
      queryClient.invalidateQueries({ queryKey: ['session-substitutions'] });
      handleOpenChange(false);
    }
  };

  const handleRequestCoach = async () => {
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from('session_substitutions' as any).insert({
      athlete_id: user.id,
      original_session_id: session.id,
      reason,
      reason_details: reasonDetails || null,
      source: 'coach_request',
      status: 'pending_coach',
      substitute_session_name: `[Pending] ${session.session_name}`,
      substitute_discipline: session.discipline,
      substitute_duration_min: session.duration_min,
      substitute_workout_details: null,
      substitute_notes: `Athlete requested substitution. Reason: ${reasonLabel}. ${reasonDetails || ''}`,
    });
    setLoading(false);
    if (error) {
      toast.error('Failed to send: ' + error.message);
    } else {
      toast.success('Request sent to coach! 📩');
      queryClient.invalidateQueries({ queryKey: ['session-substitutions'] });
      setStep('coach_sent');
    }
  };

  const handleNext = () => {
    if (step === 'reason') {
      setStep('method');
    } else if (step === 'method') {
      if (method === 'ai') handleGenerateAI();
      else handleRequestCoach();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full" size="sm">
          <ArrowLeftRight className="h-4 w-4 mr-2" /> Swap Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            Swap: {session.session_name}
          </DialogTitle>
        </DialogHeader>

        {step === 'reason' && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Why do you need to swap?</Label>
              <RadioGroup value={reason} onValueChange={setReason}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no_equipment" id="no_equipment" />
                  <Label htmlFor="no_equipment" className="text-sm cursor-pointer">Equipment unavailable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="less_time" id="less_time" />
                  <Label htmlFor="less_time" className="text-sm cursor-pointer">Less time available</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="other" id="other" />
                  <Label htmlFor="other" className="text-sm cursor-pointer">Other</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Details (optional)</Label>
              <Textarea
                value={reasonDetails}
                onChange={e => setReasonDetails(e.target.value)}
                placeholder="e.g. Only have dumbbells today, or only 20 min available"
                rows={2}
              />
            </div>
            <Button className="w-full" onClick={handleNext}>Next</Button>
          </div>
        )}

        {step === 'method' && (
          <div className="space-y-4 pt-2">
            <Label className="text-sm font-medium">How would you like to get a substitute?</Label>
            <RadioGroup value={method} onValueChange={v => setMethod(v as 'ai' | 'coach')}>
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setMethod('ai')}>
                <RadioGroupItem value="ai" id="ai" className="mt-0.5" />
                <div>
                  <Label htmlFor="ai" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-primary" /> AI generates alternative
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Instant equivalent session based on your constraints</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border bg-card hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => setMethod('coach')}>
                <RadioGroupItem value="coach" id="coach" className="mt-0.5" />
                <div>
                  <Label htmlFor="coach" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 text-primary" /> Request from coach
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Send a swap request for your coach to approve</p>
                </div>
              </div>
            </RadioGroup>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('reason')}>Back</Button>
              <Button className="flex-1" onClick={handleNext} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : method === 'ai' ? 'Generate' : 'Send Request'}
              </Button>
            </div>
          </div>
        )}

        {step === 'ai_result' && aiResult && (
          <div className="space-y-4 pt-2">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/50 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{aiResult.name}</span>
                <Badge variant="secondary" className="text-[10px]">{aiResult.discipline}</Badge>
                {aiResult.duration && <Badge variant="outline" className="text-[10px]">{aiResult.duration}′</Badge>}
              </div>
              <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{aiResult.details}</ReactMarkdown>
              </div>
              {aiResult.notes && (
                <p className="text-xs text-muted-foreground italic mt-2">💡 {aiResult.notes}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setStep('method'); setAiResult(null); }}>
                Try Again
              </Button>
              <Button className="flex-1 gradient-hyrox" onClick={handleAcceptAI} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept Swap'}
              </Button>
            </div>
          </div>
        )}

        {step === 'coach_sent' && (
          <div className="text-center py-6 space-y-3">
            <UserCheck className="h-10 w-10 text-primary mx-auto" />
            <p className="text-sm font-medium">Request sent to your coach!</p>
            <p className="text-xs text-muted-foreground">You'll see the substitute once they approve it.</p>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
