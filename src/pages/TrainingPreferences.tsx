import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ArrowLeft, Loader2, Save } from 'lucide-react';
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

export default function TrainingPreferences() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availableDays, setAvailableDays] = useState<number[]>([1, 3, 5]);
  const [sessionLength, setSessionLength] = useState(60);
  const [weights, setWeights] = useState<Record<RunType, number>>(DEFAULT_WEIGHTS);
  const [strengthPerWeek, setStrengthPerWeek] = useState(2);
  const [mobilityPerWeek, setMobilityPerWeek] = useState(1);
  const [muscleFocus, setMuscleFocus] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<Record<string, boolean>>({});

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
        setStrengthPerWeek(data.strength_sessions_per_week ?? 2);
        setMobilityPerWeek(data.mobility_technique_sessions_per_week ?? 1);
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
    if (total <= 0) return;
    const next = { ...weights };
    RUN_TYPES.forEach((k) => { next[k] = Math.round((weights[k] / total) * 100) / 100; });
    setWeights(next);
  };

  const toggleMuscle = (m: string) => {
    setMuscleFocus((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const valid = availableDays.length > 0 && weightsPctSum > 0;

  const onSave = async () => {
    if (!user || !valid) return;
    setSaving(true);
    const { error } = await supabase
      .from('training_preferences')
      .upsert({
        athlete_id: user.id,
        available_days: availableDays,
        session_length_min: sessionLength,
        run_type_weights: weights,
        strength_sessions_per_week: strengthPerWeek,
        mobility_technique_sessions_per_week: mobilityPerWeek,
        muscle_focus: muscleFocus,
        equipment,
      }, { onConflict: 'athlete_id' });
    setSaving(false);
    if (error) {
      toast.error('Could not save preferences');
    } else {
      toast.success('Training preferences saved');
    }
  };

  return (
    <div className="container max-w-3xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
          <Card>
            <CardHeader>
              <CardTitle>Available training days</CardTitle>
              <CardDescription>Pick the days you can train each week.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const active = availableDays.includes(d.v);
                  return (
                    <button
                      key={d.v}
                      type="button"
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
              {availableDays.length === 0 && (
                <p className="text-sm text-destructive mt-3">Select at least one day.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session length</CardTitle>
              <CardDescription>Average minutes you have per session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Duration</Label>
                <Badge variant="secondary">{sessionLength} min</Badge>
              </div>
              <Slider
                min={20} max={180} step={5}
                value={[sessionLength]}
                onValueChange={(v) => setSessionLength(v[0])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run type mix</CardTitle>
              <CardDescription>
                Distribute your weekly running focus. Total should equal 100%.
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
                    />
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className={`text-sm ${weightsPctSum === 100 ? 'text-muted-foreground' : 'text-destructive'}`}>
                  Total: {weightsPctSum}%
                </span>
                <Button type="button" variant="outline" size="sm" onClick={normalize}>
                  Normalize to 100%
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Strength & mobility</CardTitle>
              <CardDescription>Sessions per week, outside of runs.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="strength">Strength sessions</Label>
                <Input
                  id="strength"
                  type="number" min={0} max={7}
                  value={strengthPerWeek}
                  onChange={(e) => setStrengthPerWeek(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobility">Mobility / technique</Label>
                <Input
                  id="mobility"
                  type="number" min={0} max={7}
                  value={mobilityPerWeek}
                  onChange={(e) => setMobilityPerWeek(Math.max(0, Math.min(7, Number(e.target.value) || 0)))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Muscle focus</CardTitle>
              <CardDescription>Areas you want to emphasize.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {MUSCLE_FOCUS_OPTIONS.map((m) => {
                  const active = muscleFocus.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
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
              <CardDescription>Check everything you can access.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
            </CardContent>
          </Card>

          <div className="flex justify-end sticky bottom-4">
            <Button onClick={onSave} disabled={!valid || saving} size="lg">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save preferences
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
