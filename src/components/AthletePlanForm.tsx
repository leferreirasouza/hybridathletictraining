import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

const hyroxStations = [
  'SkiErg', 'Sled Push', 'Sled Pull', 'Burpee Broad Jumps',
  'Row', 'Farmers Carry', 'Sandbag Lunges', 'Wall Balls',
];

const experienceLevels = [
  { value: 'beginner', label: 'Beginner', desc: 'First HYROX or <6 months training' },
  { value: 'intermediate', label: 'Intermediate', desc: '1-3 HYROX races completed' },
  { value: 'advanced', label: 'Advanced', desc: '3+ races, competitive times' },
];

const focusOptions = [
  { value: 'balanced', label: 'Balanced', desc: 'Running + Stations equally' },
  { value: 'running', label: 'Running Focus', desc: 'Prioritize running speed/endurance' },
  { value: 'stations', label: 'Stations Focus', desc: 'Prioritize station performance' },
];

export default function AthletePlanForm() {
  const { user, currentOrg } = useAuth();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);

  const [experience, setExperience] = useState('beginner');
  const [trainingDays, setTrainingDays] = useState('4');
  const [easyPace, setEasyPace] = useState('');
  const [racePace, setRacePace] = useState('');
  const [raceDate, setRaceDate] = useState('');
  const [planWeeks, setPlanWeeks] = useState('8');
  const [planFocus, setPlanFocus] = useState('balanced');
  const [weakStations, setWeakStations] = useState<string[]>([]);
  const [injuries, setInjuries] = useState('');
  const [goals, setGoals] = useState('');

  // Fetch race results
  const { data: raceResults } = useQuery({
    queryKey: ['race-results-for-plan', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('race_results' as any)
        .select('*')
        .eq('athlete_id', user.id)
        .order('race_date', { ascending: false });
      return error ? [] : (data as any[]) || [];
    },
    enabled: !!user,
  });

  const toggleStation = (station: string) => {
    setWeakStations(prev =>
      prev.includes(station) ? prev.filter(s => s !== station) : [...prev, station]
    );
  };

  const handleGenerate = async () => {
    if (!user || !currentOrg) { toast.error('Not logged in'); return; }
    if (!trainingDays || parseInt(trainingDays) < 2 || parseInt(trainingDays) > 7) {
      toast.error('Training days must be between 2 and 7');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          organizationId: currentOrg.id,
          profile: {
            experience,
            trainingDays: parseInt(trainingDays),
            easyPace: easyPace || undefined,
            racePace: racePace || undefined,
            raceDate: raceDate || undefined,
            planWeeks: parseInt(planWeeks) || 8,
            planFocus,
            weakStations: weakStations.length > 0 ? weakStations : undefined,
            injuries: injuries.trim() || undefined,
            goals: goals.trim() || undefined,
            raceResults: raceResults && raceResults.length > 0 ? raceResults : undefined,
          },
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Plan "${data.planName}" created with ${data.sessionsCreated} sessions!`);
      navigate('/schedule');
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Race Results Banner */}
      {raceResults && raceResults.length > 0 && (
        <Card className="glass border-success/20 overflow-hidden">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium">
                {raceResults.length} race result{raceResults.length > 1 ? 's' : ''} will be used
              </p>
              <p className="text-[10px] text-muted-foreground">
                AI will analyze your splits to tailor the plan
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/races')}>
              View
            </Button>
          </CardContent>
        </Card>
      )}

      {!raceResults?.length && (
        <Card className="glass border-primary/20 overflow-hidden">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium">Add race results for a better plan</p>
              <p className="text-[10px] text-muted-foreground">
                Upload ROX Fit screenshots or enter splits manually
              </p>
            </div>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate('/races')}>
              Add
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="glass overflow-hidden">
        <div className="h-1 gradient-hyrox" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Your Athlete Profile
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Tell us about yourself and we'll generate a tailored HYROX plan.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Experience */}
          <div className="space-y-2">
            <Label>HYROX Experience</Label>
            <div className="grid grid-cols-3 gap-2">
              {experienceLevels.map(lvl => (
                <button
                  key={lvl.value}
                  type="button"
                  onClick={() => setExperience(lvl.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    experience === lvl.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-xs font-medium">{lvl.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{lvl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Plan Focus */}
          <div className="space-y-2">
            <Label>Plan Focus</Label>
            <div className="grid grid-cols-3 gap-2">
              {focusOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPlanFocus(opt.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    planFocus === opt.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-xs font-medium">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Training Availability */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Training Days/Week</Label>
              <Select value={trainingDays} onValueChange={setTrainingDays}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 7].map(d => (
                    <SelectItem key={d} value={String(d)}>{d} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Plan Duration</Label>
              <Select value={planWeeks} onValueChange={setPlanWeeks}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 6, 8, 10, 12, 16].map(w => (
                    <SelectItem key={w} value={String(w)}>{w} weeks</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Paces */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Easy Pace (min/km)</Label>
              <Input value={easyPace} onChange={e => setEasyPace(e.target.value)} placeholder="6:00" className="h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Race Pace (min/km)</Label>
              <Input value={racePace} onChange={e => setRacePace(e.target.value)} placeholder="5:00" className="h-9" />
            </div>
          </div>

          {/* Race Date */}
          <div className="space-y-2">
            <Label>Goal Race Date (optional)</Label>
            <Input type="date" value={raceDate} onChange={e => setRaceDate(e.target.value)} className="h-9" />
          </div>

          {/* Weak Stations */}
          <div className="space-y-2">
            <Label>Weakest Stations (select any)</Label>
            <div className="flex flex-wrap gap-2">
              {hyroxStations.map(station => (
                <Badge
                  key={station}
                  variant={weakStations.includes(station) ? 'default' : 'outline'}
                  className={`cursor-pointer transition-colors ${
                    weakStations.includes(station)
                      ? 'gradient-hyrox text-primary-foreground border-0'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => toggleStation(station)}
                >
                  {station}
                </Badge>
              ))}
            </div>
          </div>

          {/* Injuries */}
          <div className="space-y-2">
            <Label>Injuries / Limitations (optional)</Label>
            <Textarea
              value={injuries}
              onChange={e => setInjuries(e.target.value)}
              placeholder="e.g. Knee pain when lunging, tight hip flexors…"
              rows={2}
              className="text-sm"
              maxLength={500}
            />
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label>Additional Goals (optional)</Label>
            <Textarea
              value={goals}
              onChange={e => setGoals(e.target.value)}
              placeholder="e.g. Sub 1:20 HYROX time, improve running endurance…"
              rows={2}
              className="text-sm"
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full gradient-hyrox"
        size="lg"
        onClick={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating your plan…</>
        ) : (
          <><Sparkles className="h-4 w-4 mr-2" /> Generate My HYROX Plan</>
        )}
      </Button>

      {generating && (
        <p className="text-xs text-center text-muted-foreground animate-pulse">
          AI is building your personalized plan. This may take 15-30 seconds…
        </p>
      )}
    </motion.div>
  );
}
