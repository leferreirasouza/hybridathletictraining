import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft, Loader2, Save, AlertCircle, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const DAYS = [
  { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 7, l: 'Sun' },
];

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'fartlek'] as const;
type RunType = typeof RUN_TYPES[number];

const MUSCLE_FOCUS_OPTIONS = [
  'posterior chain', 'anterior chain', 'core', 'upper body', 'grip', 'none',
];

const EQUIPMENT_OPTIONS = [
  'barbell', 'dumbbells', 'kettlebell', 'sled', 'ski erg', 'rower',
  'assault bike', 'wall ball', 'sandbag', 'pull-up bar', 'box', 'none',
];

const DEFAULT_WEIGHTS: Record<RunType, number> = {
  easy: 0.6, tempo: 0.15, interval: 0.1, long: 0.15, fartlek: 0,
};

const SESSION_MIN = 20;
const SESSION_MAX = 180;
const COUNT_MIN = 0;
const COUNT_MAX = 7;

const prefsSchema = z.object({
  available_days: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'Select at least one training day.')
    .max(7, 'A week only has 7 days.'),
  session_length_min: z
    .number({ invalid_type_error: 'Session length must be a number.' })
    .int('Session length must be a whole number of minutes.')
    .min(SESSION_MIN, `Session length must be at least ${SESSION_MIN} minutes.`)
    .max(SESSION_MAX, `Session length cannot exceed ${SESSION_MAX} minutes.`),
  run_type_weights: z
    .record(z.number().min(0).max(1))
    .refine(
      (w) => {
        const total = RUN_TYPES.reduce((s, k) => s + (w[k] || 0), 0);
        return Math.abs(total - 1) < 0.011;
      },
      { message: 'Run type weights must add up to 100%.' }
    ),
  strength_sessions_per_week: z
    .number({ invalid_type_error: 'Enter a whole number.' })
    .int('Must be a whole number.')
    .min(COUNT_MIN, 'Cannot be negative.')
    .max(COUNT_MAX, 'Cannot exceed 7 per week.'),
  mobility_technique_sessions_per_week: z
    .number({ invalid_type_error: 'Enter a whole number.' })
    .int('Must be a whole number.')
    .min(COUNT_MIN, 'Cannot be negative.')
    .max(COUNT_MAX, 'Cannot exceed 7 per week.'),
  equipment: z
    .record(z.boolean())
    .refine(
      (e) => Object.values(e).some(Boolean),
      { message: 'none-selected' }
    )
    .refine(
      (e) => {
        const selected = Object.keys(e).filter((k) => e[k]);
        return !(selected.includes('none') && selected.length > 1);
      },
      { message: 'none-conflict' }
    ),
});

type FieldErrors = Partial<Record<
  'available_days' | 'session_length_min' | 'run_type_weights' |
  'strength_sessions_per_week' | 'mobility_technique_sessions_per_week' | 'equipment',
  string
>>;

interface PresetRow {
  id: string;
  name: string;
  description: string | null;
  equipment: Record<string, boolean>;
  run_type_weights: Record<RunType, number>;
}

export default function TrainingPreferences() {
  const navigate = useNavigate();
  const { user, currentOrg } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableDays, setAvailableDays] = useState<number[]>([1, 3, 5]);
  const [sessionLength, setSessionLength] = useState(60);
  const [weights, setWeights] = useState<Record<RunType, number>>(DEFAULT_WEIGHTS);
  const [strengthInput, setStrengthInput] = useState('2');
  const [mobilityInput, setMobilityInput] = useState('1');
  const [muscleFocus, setMuscleFocus] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [presets, setPresets] = useState<PresetRow[]>([]);
  const [appliedPresetId, setAppliedPresetId] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('training_preferences')
        .select('*')
        .eq('athlete_id', user.id)
        .maybeSingle();
      if (error) {
        toast.error('Failed to load preferences');
      } else if (data) {
        setAvailableDays(data.available_days || [1, 3, 5]);
        setSessionLength(data.session_length_min || 60);
        const w = (data.run_type_weights as Record<string, number>) || {};
        setWeights({
          easy: w.easy ?? 0.6, tempo: w.tempo ?? 0.15, interval: w.interval ?? 0.1,
          long: w.long ?? 0.15, fartlek: w.fartlek ?? 0,
        });
        setStrengthInput(String(data.strength_sessions_per_week ?? 2));
        setMobilityInput(String(data.mobility_technique_sessions_per_week ?? 1));
        setMuscleFocus(data.muscle_focus || []);
        setEquipment((data.equipment as Record<string, boolean>) || {});
      }
      setLoading(false);
    })();
  }, [user]);

  const weightsPctSum = useMemo(
    () => Math.round(RUN_TYPES.reduce((s, k) => s + (weights[k] || 0), 0) * 100),
    [weights]
  );

  const buildPayload = () => ({
    available_days: availableDays,
    session_length_min: sessionLength,
    run_type_weights: weights,
    strength_sessions_per_week: Number(strengthInput),
    mobility_technique_sessions_per_week: Number(mobilityInput),
    equipment,
  });

  const validate = (): FieldErrors => {
    const payload = buildPayload();
    const result = prefsSchema.safeParse(payload);
    if (result.success) return {};
    const errs: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof FieldErrors;
      if (key && !errs[key]) errs[key] = issue.message;
    }
    return errs;
  };

  const isValid = Object.keys(validate()).length === 0;

  // Re-validate after submission attempt so users see errors clear as they fix them.
  useEffect(() => {
    if (!submitted) return;
    setErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDays, sessionLength, weights, strengthInput, mobilityInput, equipment, submitted]);

  const toggleDay = (d: number) => {
    setAvailableDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  };

  const setWeightPct = (k: RunType, pct: number) => {
    setWeights((prev) => ({ ...prev, [k]: pct / 100 }));
  };

  const normalize = () => {
    const total = RUN_TYPES.reduce((s, k) => s + (weights[k] || 0), 0);
    if (total <= 0) {
      toast.error('Set at least one run type above 0% before normalizing.');
      return;
    }
    // Round to nearest 1% and fix any rounding drift on the largest bucket.
    const raw = RUN_TYPES.map((k) => ({ k, v: Math.round((weights[k] / total) * 100) }));
    let drift = 100 - raw.reduce((s, r) => s + r.v, 0);
    if (drift !== 0) {
      raw.sort((a, b) => b.v - a.v);
      raw[0].v += drift;
    }
    const next = { ...weights };
    raw.forEach((r) => { next[r.k as RunType] = r.v / 100; });
    setWeights(next);
  };

  const toggleMuscle = (m: string) => {
    setMuscleFocus((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const onSave = async () => {
    if (!user) return;
    setSubmitted(true);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Please fix the highlighted fields before saving.');
      return;
    }

    setSaving(true);
    const payload = buildPayload();
    const { data, error } = await supabase
      .from('training_preferences')
      .upsert(
        { athlete_id: user.id, muscle_focus: muscleFocus, ...payload },
        { onConflict: 'athlete_id' }
      )
      .select()
      .single();
    setSaving(false);

    if (error || !data) {
      console.error('Save training preferences failed:', error);
      toast.error(error?.message || 'Could not save preferences. Please try again.');
      return;
    }

    // Confirm persistence by re-hydrating from the server response.
    setAvailableDays(data.available_days || []);
    setSessionLength(data.session_length_min);
    setWeights(data.run_type_weights as Record<RunType, number>);
    setStrengthInput(String(data.strength_sessions_per_week));
    setMobilityInput(String(data.mobility_technique_sessions_per_week));
    setEquipment((data.equipment as Record<string, boolean>) || {});
    toast.success('Training preferences saved');
  };

  const errorList = Object.values(errors);

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Training Preferences</h1>
          <p className="text-sm text-muted-foreground">
            Tell your AI coach how you train. Used when generating and adjusting plans.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          {submitted && errorList.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fix the following before saving</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {errorList.map((e) => <li key={e}>{e}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Available training days</CardTitle>
              <CardDescription>Pick the days you can train each week.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Available training days"
                aria-invalid={!!errors.available_days}
                aria-describedby={errors.available_days ? 'days-error' : undefined}
              >
                {DAYS.map((d) => {
                  const active = availableDays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(d.v)}
                      className={`px-4 py-2 rounded-full text-sm border transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
              {errors.available_days && (
                <p id="days-error" className="text-sm text-destructive mt-3">
                  {errors.available_days}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session length</CardTitle>
              <CardDescription>
                Average minutes you have per session ({SESSION_MIN}–{SESSION_MAX} min).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Duration</Label>
                <Badge variant="secondary">{sessionLength} min</Badge>
              </div>
              <Slider
                min={SESSION_MIN} max={SESSION_MAX} step={5}
                value={[sessionLength]}
                onValueChange={(v) => setSessionLength(v[0])}
                aria-label="Session length in minutes"
              />
              {errors.session_length_min && (
                <p className="text-sm text-destructive">{errors.session_length_min}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run type mix</CardTitle>
              <CardDescription>
                Distribute your weekly running focus. Total must equal 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {RUN_TYPES.map((k) => {
                const pct = Math.round((weights[k] || 0) * 100);
                return (
                  <div key={k} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="capitalize">{k}</Label>
                      <Badge variant="secondary">{pct}%</Badge>
                    </div>
                    <Slider
                      min={0} max={100} step={5}
                      value={[pct]}
                      onValueChange={(v) => setWeightPct(k, v[0])}
                      aria-label={`${k} weight`}
                    />
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t">
                <span
                  className={`text-sm ${
                    weightsPctSum === 100 ? 'text-muted-foreground' : 'text-destructive'
                  }`}
                  aria-live="polite"
                >
                  Total: {weightsPctSum}%
                  {weightsPctSum !== 100 && (
                    <> — adjust by {weightsPctSum > 100 ? '-' : '+'}{Math.abs(100 - weightsPctSum)}%</>
                  )}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={normalize}>
                  Normalize to 100%
                </Button>
              </div>
              {errors.run_type_weights && (
                <p className="text-sm text-destructive">{errors.run_type_weights}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strength & mobility</CardTitle>
              <CardDescription>Sessions per week (0–7), outside of runs.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="strength">Strength sessions</Label>
                <Input
                  id="strength"
                  type="number"
                  inputMode="numeric"
                  min={COUNT_MIN}
                  max={COUNT_MAX}
                  value={strengthInput}
                  onChange={(e) => setStrengthInput(e.target.value)}
                  aria-invalid={!!errors.strength_sessions_per_week}
                  aria-describedby={errors.strength_sessions_per_week ? 'strength-error' : undefined}
                />
                {errors.strength_sessions_per_week && (
                  <p id="strength-error" className="text-sm text-destructive">
                    {errors.strength_sessions_per_week}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobility">Mobility / technique</Label>
                <Input
                  id="mobility"
                  type="number"
                  inputMode="numeric"
                  min={COUNT_MIN}
                  max={COUNT_MAX}
                  value={mobilityInput}
                  onChange={(e) => setMobilityInput(e.target.value)}
                  aria-invalid={!!errors.mobility_technique_sessions_per_week}
                  aria-describedby={
                    errors.mobility_technique_sessions_per_week ? 'mobility-error' : undefined
                  }
                />
                {errors.mobility_technique_sessions_per_week && (
                  <p id="mobility-error" className="text-sm text-destructive">
                    {errors.mobility_technique_sessions_per_week}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Muscle focus</CardTitle>
              <CardDescription>Optional — areas you want to emphasize.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_FOCUS_OPTIONS.map((m) => {
                  const active = muscleFocus.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleMuscle(m)}
                      className={`px-3 py-1.5 rounded-full text-sm border capitalize transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background border-border hover:bg-muted'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Equipment available</CardTitle>
              <CardDescription>
                Check everything you can access. If you train with nothing, pick "none".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                aria-invalid={!!errors.equipment}
                aria-describedby={errors.equipment ? 'equipment-error' : undefined}
              >
                {EQUIPMENT_OPTIONS.map((e) => (
                  <label key={e} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={!!equipment[e]}
                      onCheckedChange={(c) =>
                        setEquipment((prev) => ({ ...prev, [e]: !!c }))
                      }
                    />
                    <span className="text-sm capitalize">{e}</span>
                  </label>
                ))}
              </div>
              {errors.equipment && (
                <p id="equipment-error" className="text-sm text-destructive mt-3">
                  {errors.equipment === 'none-selected'
                    ? 'Pick at least one equipment option (choose "none" if you have nothing).'
                    : errors.equipment === 'none-conflict'
                    ? 'If you select "none", you cannot also select other equipment.'
                    : errors.equipment}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end sticky bottom-4">
            <Button onClick={onSave} disabled={saving || !isValid} size="lg">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save preferences
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
