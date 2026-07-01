import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Target, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DAY_LABELS,
  DISTANCE_LABELS,
  HYROX_AGE_GROUP_AVERAGES,
  fmtTime,
  type WizardAnswers,
} from '../wizardTypes';
import { StepShell } from './_shared';

interface Props {
  answers: WizardAnswers;
  update: (p: Partial<WizardAnswers>) => void;
  onGenerated: () => void;
}

/**
 * Review + generate. Lifts handleRequestPrediction logic and the HYROX
 * age-group reference table from AthletePlanForm.tsx verbatim. Persists
 * training_preferences + profile goal fields, then invokes generate-plan
 * (passing athleteId when coach is generating on someone else's behalf).
 */
export default function ReviewStep({ answers, update, onGenerated }: Props) {
  const { user, currentOrg } = useAuth();
  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [generating, setGenerating] = useState(false);

  const ageGroup = answers.ageGroup ?? '30-34';
  const ageGroupRef = HYROX_AGE_GROUP_AVERAGES[ageGroup];

  const targetAthleteId = answers.athleteId ?? user?.id;
  const isHyrox = answers.goalType === 'hyrox';
  const raceType = isHyrox ? 'hyrox' : 'running';
  const totalTrainingDays =
    (answers.runDaysPerWeek ?? 0) + (answers.strengthSessionsPerWeek ?? 0);

  const buildProfile = (forPrediction: boolean) => ({
    raceType,
    experience: answers.runAbility,
    trainingDays: totalTrainingDays || (answers.runDaysPerWeek ?? 3),
    raceDate: answers.raceDate,
    raceName: forPrediction ? undefined : answers.raceName,
    runDistance: !isHyrox ? answers.raceDistance : undefined,
    targetTime:
      !isHyrox && answers.raceTimeSeconds ? fmtTime(answers.raceTimeSeconds) : undefined,
    totalTarget:
      isHyrox && answers.raceTimeSeconds ? fmtTime(answers.raceTimeSeconds) : undefined,
    ageGroup,
    ...(forPrediction ? {} : { planWeeks: 8, planFocus: answers.strengthGoal }),
  });

  // Persist preferences + profile goal fields before generating.
  const persistAnswers = async () => {
    if (!targetAthleteId) return;
    const equipmentJson = answers.equipment ?? { items: {} };

    await supabase.from('training_preferences').upsert(
      [
        {
          athlete_id: targetAthleteId,
          available_days: answers.runDays ?? [],
          strength_days: answers.strengthDays ?? [],
          mobility_days: [],
          run_type_weights: { easy: 0.6, tempo: 0.15, interval: 0.1, long: 0.15, fartlek: 0 },
          strength_sessions_per_week: answers.strengthSessionsPerWeek ?? 0,
          mobility_technique_sessions_per_week: answers.mobilitySessionsPerWeek ?? 0,
          muscle_focus: [],
          mobility_tech_weights: answers.mobilityWeights ?? {},
          session_length_min: answers.sessionLengthMin ?? 45,
          equipment: equipmentJson,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'athlete_id' },
    );

    await supabase
      .from('profiles')
      .update({
        goal_race_date: answers.raceDate ?? null,
        goal_race_name: answers.raceName ?? null,
        goal_finish_time_seconds: answers.raceTimeSeconds ?? null,
      })
      .eq('id', targetAthleteId);
  };

  const handleRequestPrediction = async () => {
    if (!user || !currentOrg) return;
    setLoadingPrediction(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          organizationId: currentOrg.id,
          athleteId: answers.athleteId,
          predictionOnly: true,
          profile: buildProfile(true),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPrediction(data.prediction);
    } catch (e: any) {
      toast.error(e.message || 'Failed to get prediction');
    } finally {
      setLoadingPrediction(false);
    }
  };

  const handleGenerate = async () => {
    if (!user || !currentOrg) {
      toast.error('Not signed in');
      return;
    }
    setGenerating(true);
    try {
      await persistAnswers();
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          organizationId: currentOrg.id,
          athleteId: answers.athleteId,
          profile: buildProfile(false),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Plan "${data.planName}" created with ${data.sessionsCreated} sessions!`);
      onGenerated();
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <StepShell title="Review and generate" subtitle="Double-check your inputs, then generate the plan.">
      <div className="space-y-4">
        {/* Summary */}
        <Card className="glass overflow-hidden">
          <CardContent className="p-4 space-y-2 text-sm">
            <SummaryRow label="Goal" value={answers.goalType ?? '—'} />
            <SummaryRow label="Running ability" value={answers.runAbility ?? '—'} />
            {answers.raceTimeSeconds && (
              <SummaryRow
                label="Race PR"
                value={`${fmtTime(answers.raceTimeSeconds)} (${DISTANCE_LABELS[answers.raceDistance ?? '10k']})`}
              />
            )}
            <SummaryRow
              label="Run days"
              value={`${answers.runDaysPerWeek ?? 0} / week · ${(answers.runDays ?? []).map((d) => DAY_LABELS[d]).join(', ') || '—'}`}
            />
            <SummaryRow
              label="Strength"
              value={`${answers.strengthSessionsPerWeek ?? 0} × ${answers.sessionLengthMin ?? 45}min · ${(answers.strengthDays ?? []).map((d) => DAY_LABELS[d]).join(', ') || '—'}`}
            />
            <SummaryRow label="Mobility" value={`${answers.mobilitySessionsPerWeek ?? 0} / week`} />
            {answers.raceDate && <SummaryRow label="Race" value={`${answers.raceName ?? 'Race'} · ${answers.raceDate}`} />}
          </CardContent>
        </Card>

        {/* Age-group reference (lifted verbatim from AthletePlanForm) */}
        {isHyrox && (
          <Card className="glass border-muted overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <Label className="font-display font-bold text-sm">Age Group Reference</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Used as a fallback target if you don't have prior HYROX race history.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs">Your Age Group</Label>
                <Select value={ageGroup} onValueChange={(v) => update({ ageGroup: v })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(HYROX_AGE_GROUP_AVERAGES).map(([key, v]) => (
                      <SelectItem key={key} value={key}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {ageGroupRef && (
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-primary/5 rounded-lg p-2 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground">Avg Total Time</p>
                    <p className="text-sm font-mono font-bold text-primary">{fmtTime(ageGroupRef.total)}</p>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-2 border border-primary/10">
                    <p className="text-[10px] text-muted-foreground">Avg Run Pace</p>
                    <p className="text-sm font-mono font-bold text-primary">{fmtTime(ageGroupRef.runPerKm)}/km</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Prediction */}
        <Card className="glass overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="font-display font-bold text-sm">AI Prediction</Label>
              </div>
              <Button variant="outline" size="sm" onClick={handleRequestPrediction} disabled={loadingPrediction}>
                {loadingPrediction ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Preview'}
              </Button>
            </div>
            {prediction && <PredictionView prediction={prediction} />}
          </CardContent>
        </Card>

        <Button onClick={handleGenerate} disabled={generating} className="w-full" size="lg">
          {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating…</> : 'Generate plan'}
        </Button>
      </div>
    </StepShell>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 last:border-0 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
