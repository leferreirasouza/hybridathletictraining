import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, Upload, Check, AlertTriangle, ImagePlus, X, Images } from 'lucide-react';

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
  _sourceIndex?: number; // track which image it came from
};

type ImageItem = {
  dataUrl: string;
  name: string;
  status: 'pending' | 'parsing' | 'done' | 'error';
  exerciseCount?: number;
  error?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_IMAGES = 20;

export default function ScreenshotParserDialog({ open, onOpenChange }: Props) {
  const { user, currentOrg } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [exercises, setExercises] = useState<ExtractedExercise[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setImages([]);
    setExercises([]);
    setSelected(new Set());
    setParsing(false);
    setParseProgress(0);
    setSaving(false);
  };

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    if (files.length > remaining) {
      toast.error(`You can upload up to ${MAX_IMAGES} images. ${remaining} slots remaining.`);
    }
    const validFiles = files.slice(0, remaining);

    const oversized = validFiles.filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length) {
      toast.error(`${oversized.length} image(s) over 10MB were skipped`);
    }

    const accepted = validFiles.filter(f => f.size <= 10 * 1024 * 1024);
    if (!accepted.length) return;

    const newItems: ImageItem[] = [];
    for (const file of accepted) {
      const dataUrl = await readFileAsDataUrl(file);
      newItems.push({ dataUrl, name: file.name, status: 'pending' });
    }

    setImages(prev => [...prev, ...newItems]);
    setExercises([]);
    setSelected(new Set());

    // Reset file input
    if (fileRef.current) fileRef.current.value = '';
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
    if (images.length <= 1) {
      setExercises([]);
      setSelected(new Set());
    }
  };

  const parseOneImage = async (base64: string, token: string): Promise<{ exercises: ExtractedExercise[]; confidence: string; notes: string }> => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-exercise-screenshot`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ imageBase64: base64 }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Failed (${response.status})`);
    }

    const result = await response.json();
    return result.data;
  };

  const handleParseAll = async () => {
    if (!images.length) return;
    setParsing(true);
    setParseProgress(0);
    setExercises([]);
    setSelected(new Set());

    try {
      const session_token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!session_token) throw new Error('Not authenticated');

      const allExercises: ExtractedExercise[] = [];
      let completed = 0;

      for (let i = 0; i < images.length; i++) {
        setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'parsing' } : img));

        try {
          const base64 = images[i].dataUrl.split(',')[1];
          const data = await parseOneImage(base64, session_token);
          const exs = (data.exercises || []).map((ex: ExtractedExercise) => ({ ...ex, _sourceIndex: i }));
          allExercises.push(...exs);

          setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'done', exerciseCount: exs.length } : img));
        } catch (err: any) {
          setImages(prev => prev.map((img, idx) => idx === i ? { ...img, status: 'error', error: err.message } : img));
        }

        completed++;
        setParseProgress(Math.round((completed / images.length) * 100));
      }

      setExercises(allExercises);
      setSelected(new Set(allExercises.map((_, i) => i)));
      toast.success(`Found ${allExercises.length} exercises from ${images.length} images`);
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

  const pendingCount = images.filter(i => i.status === 'pending').length;
  const doneCount = images.filter(i => i.status === 'done').length;
  const errorCount = images.filter(i => i.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Extract Exercises from Screenshots
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4 pb-4">
            {/* Upload area */}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={images.length >= MAX_IMAGES || parsing}
              className="w-full border-2 border-dashed border-muted-foreground/25 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ImagePlus className="h-8 w-8 text-muted-foreground/50" />
              <div className="text-center">
                <p className="text-sm font-medium">
                  {images.length === 0 ? 'Upload training screenshots' : 'Add more screenshots'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Up to {MAX_IMAGES} images · {images.length}/{MAX_IMAGES} added
                </p>
              </div>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFiles}
            />

            {/* Image thumbnails */}
            {images.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Images className="h-4 w-4" />
                    {images.length} image{images.length !== 1 ? 's' : ''}
                  </p>
                  {(doneCount > 0 || errorCount > 0) && (
                    <span className="text-xs text-muted-foreground">
                      {doneCount} done{errorCount > 0 && `, ${errorCount} failed`}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {images.map((img, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border aspect-square">
                      <img src={img.dataUrl} alt={img.name} className="w-full h-full object-cover" />
                      {/* Status overlay */}
                      {img.status === 'parsing' && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      )}
                      {img.status === 'done' && (
                        <div className="absolute bottom-0 inset-x-0 bg-primary/90 text-primary-foreground text-[10px] text-center py-0.5">
                          {img.exerciseCount} found
                        </div>
                      )}
                      {img.status === 'error' && (
                        <div className="absolute bottom-0 inset-x-0 bg-destructive/90 text-destructive-foreground text-[10px] text-center py-0.5">
                          Failed
                        </div>
                      )}
                      {/* Remove button */}
                      {!parsing && (
                        <button
                          onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                          className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Parse progress */}
                {parsing && (
                  <div className="space-y-1.5">
                    <Progress value={parseProgress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      Analyzing {parseProgress}%...
                    </p>
                  </div>
                )}

                {/* Parse button */}
                {exercises.length === 0 && !parsing && (
                  <Button onClick={handleParseAll} className="w-full">
                    <Upload className="h-4 w-4 mr-2" />
                    Extract from {images.length} Image{images.length !== 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            )}

            {/* Results */}
            {exercises.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{exercises.length} exercises found</p>
                  <span className="text-xs text-muted-foreground">{selected.size} selected</span>
                </div>

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
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold">{ex.name}</p>
                          {ex._sourceIndex !== undefined && (
                            <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">
                              img {ex._sourceIndex + 1}
                            </span>
                          )}
                        </div>
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
