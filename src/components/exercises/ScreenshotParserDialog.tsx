import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Upload, Check, AlertTriangle, ImagePlus } from 'lucide-react';

type ExtractedExercise = {
  name: string;
  category: string;
  discipline: string;
  muscle_groups: string[];
  equipment_required: string[];
  hyrox_station: string | null;
  difficulty_level: string;
  description: string;
  coaching_cues: string | null;
  contraindications: string | null;
  sets?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ScreenshotParserDialog({ open, onOpenChange }: Props) {
  const { user, currentOrg } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [exercises, setExercises] = useState<ExtractedExercise[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confidence, setConfidence] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setPreview(null);
    setExercises([]);
    setSelected(new Set());
    setConfidence('');
    setNotes('');
    setParsing(false);
    setSaving(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      setExercises([]);
      setSelected(new Set());
    };
    reader.readAsDataURL(file);
  };

  const handleParse = async () => {
    if (!preview) return;
    setParsing(true);

    try {
      const base64 = preview.split(',')[1];
      const session_token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!session_token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-exercise-screenshot`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ imageBase64: base64 }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to parse screenshot');
      }

      const result = await response.json();
      const extracted = result.data;
      setExercises(extracted.exercises || []);
      setConfidence(extracted.confidence || '');
      setNotes(extracted.notes || '');
      // Select all by default
      setSelected(new Set((extracted.exercises || []).map((_: any, i: number) => i)));
      toast.success(`Found ${extracted.exercises?.length || 0} exercises`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setParsing(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSave = async () => {
    if (!currentOrg || !user || selected.size === 0) return;
    setSaving(true);

    try {
      const rows = Array.from(selected).map(i => {
        const ex = exercises[i];
        return {
          organization_id: currentOrg.id,
          created_by: user.id,
          name: ex.name,
          category: ex.category || 'general',
          discipline: ex.discipline || 'custom',
          muscle_groups: ex.muscle_groups || [],
          equipment_required: ex.equipment_required || [],
          hyrox_station: ex.hyrox_station || null,
          difficulty_level: ex.difficulty_level || 'intermediate',
          description: ex.description || null,
          coaching_cues: ex.coaching_cues || null,
          contraindications: ex.contraindications || null,
          is_approved: false,
          source: 'screenshot',
        };
      });

      const { error } = await supabase.from('exercise_library' as any).insert(rows);
      if (error) throw error;

      toast.success(`${rows.length} exercises added for review`);
      queryClient.invalidateQueries({ queryKey: ['exercise-library'] });
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Extract Exercises from Screenshot
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4 pb-4">
            {/* Upload area */}
            {!preview ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/25 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <ImagePlus className="h-10 w-10 text-muted-foreground/50" />
                <div className="text-center">
                  <p className="text-sm font-medium">Upload a training screenshot</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Workout plans, exercise lists, session photos
                  </p>
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={preview} alt="Screenshot" className="w-full max-h-48 object-contain bg-muted" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => { setPreview(null); setExercises([]); setSelected(new Set()); }}
                  >
                    Change
                  </Button>
                </div>

                {exercises.length === 0 && (
                  <Button onClick={handleParse} disabled={parsing} className="w-full">
                    {parsing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Analyzing screenshot...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Extract Exercises
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />

            {/* Results */}
            {exercises.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{exercises.length} exercises found</p>
                  <div className="flex items-center gap-2">
                    {confidence && (
                      <Badge
                        variant={confidence === 'high' ? 'default' : confidence === 'medium' ? 'secondary' : 'destructive'}
                        className="text-[10px]"
                      >
                        {confidence} confidence
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                  </div>
                </div>

                {notes && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    {notes}
                  </p>
                )}

                <div className="space-y-2">
                  {exercises.map((ex, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selected.has(i) ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}
                      onClick={() => toggleSelect(i)}
                    >
                      <Checkbox checked={selected.has(i)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{ex.name}</p>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">{ex.category?.replace('_', ' ')}</Badge>
                          <Badge variant="outline" className="text-[10px]">{ex.difficulty_level}</Badge>
                          {ex.hyrox_station && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-0">
                              {ex.hyrox_station.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        {ex.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ex.description}</p>}
                        {ex.muscle_groups?.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {ex.muscle_groups.map(mg => (
                              <span key={mg} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{mg}</span>
                            ))}
                          </div>
                        )}
                        {(ex.sets || ex.reps) && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {ex.sets && `${ex.sets} sets`}{ex.sets && ex.reps && ' × '}{ex.reps && `${ex.reps} reps`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {exercises.length > 0 && (
          <Button onClick={handleSave} disabled={saving || selected.size === 0} className="mt-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Add {selected.size} to Library (Pending Review)
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
