import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Target, Sparkles, CheckCircle2, Calendar, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getDiscipline, dayLabels, formatIntensity } from '@/components/schedule/config';
import type { StepId } from '../wizardSteps.config';
import {
  DAY_LABELS,
  DISTANCE_LABELS,
  GOAL_TYPE_LABELS,
  ABILITY_LABELS,
  MOBILITY_FOCUS_LABELS,
  HYROX_AGE_GROUP_AVERAGES,
  fmtTime,
  type WizardAnswers,
} from '../wizardTypes';
import { StepShell } from './_shared';

interface Props {
  answers: WizardAnswers;
  update: (p: Partial<WizardAnswers>) => void;
  onGenerated: () => void;
  onEditStep?: (stepId: StepId) => void;
}

/**
 * Review + generate. Lifts handleRequestPrediction logic and the HYROX
 * age-group reference table from AthletePlanForm.tsx verbatim. Persists
 * training_preferences + profile goal fields, then invokes generate-plan
 * (passing athleteId when coach is generating on someone else's behalf).
 */
export default function ReviewStep({ answers, update, onGenerated, onEditStep }: Props) {
  const { user, currentOrg } = useAuth();
  const [prediction, setPrediction] = useState<any>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<{
    planId: string;
    planName: string;
    totalWeeks: number;
    sessionsCreated: number;
  } | null>(null);

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
    currentRunDaysPerWeek: answers.currentRunDaysPerWeek ?? 0,
    currentWeeklyKm: answers.currentWeeklyKm ?? 0,
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
          mobility_days: answers.mobilityDays ?? [],
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

  // Distinguishes network/transport failures from backend-reported errors
  // (data.error, thrown as Error(data.error) above) so the toast tells the
  // athlete something actionable instead of a generic "failed" every time.
  const describeError = (e: unknown, fallback: string): string => {
    const err = e as { message?: string; name?: string } | null | undefined;
    const msg = err?.message ?? '';
    const looksLikeNetworkFailure =
      err?.name === 'FunctionsFetchError' ||
      err?.name === 'TypeError' ||
      /fetch|network|failed to connect/i.test(msg);
    if (looksLikeNetworkFailure) return "Couldn't reach the server — check your connection and try again.";
    return msg || fallback;
  };

  const handleRequestPrediction = async () => {
    if (!user || !currentOrg) return;
    setLoadingPrediction(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-plan', {
        body: {
          organizationId: currentOrg.id,
          athleteId: targetAthleteId,
          predictionOnly: true,
          profile: buildProfile(true),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPrediction(data.prediction);
    } catch (e: any) {
      toast.error(describeError(e, 'Failed to get prediction'));
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
          athleteId: targetAthleteId,
          profile: buildProfile(false),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Plan "${data.planName}" created with ${data.sessionsCreated} sessions!`);
      setGeneratedPlan({
        planId: data.planId,
        planName: data.planName,
        totalWeeks: data.totalWeeks,
        sessionsCreated: data.sessionsCreated,
      });
      if (user?.id) {
        try { localStorage.removeItem(`ha-wizard-draft:${user.id}`); } catch { /* best effort */ }
      }
    } catch (e: any) {
      toast.error(describeError(e, 'Failed to generate plan'));
    } finally {
      setGenerating(false);
    }
  };

  if (generatedPlan) {
    return <GeneratedPlanPreview plan={generatedPlan} onContinue={onGenerated} />;
  }

  return (
    <StepShell title="Review and generate" subtitle="Double-check your inputs, then generate the plan.">
      <div className="space-y-4">
        {/* Summary */}
        <Card className="glass overflow-hidden">
          <CardContent className="p-4 space-y-2 text-sm">
            <SummaryRow
              label="Goal"
              value={answers.goalType ? GOAL_TYPE_LABELS[answers.goalType] : '—'}
              onEdit={onEditStep && (() => onEditStep('goalType'))}
            />
            <SummaryRow
              label="Running ability"
              value={answers.runAbility ? ABILITY_LABELS[answers.runAbility] : '—'}
              onEdit={onEditStep && (() => onEditStep('runAbility'))}
            />
            {answers.raceTimeSeconds && (
              <SummaryRow
                label="Race PR"
                value={`${fmtTime(answers.raceTimeSeconds)} (${DISTANCE_LABELS[answers.raceDistance ?? '10k']})`}
                onEdit={onEditStep && (() => onEditStep('raceTime'))}
              />
            )}
            <SummaryRow
              label="Run days"
              value={`${answers.runDaysPerWeek ?? 0} / week · ${(answers.runDays ?? []).map((d) => DAY_LABELS[d]).join(', ') || '—'}`}
              onEdit={onEditStep && (() => onEditStep('runDaysCount'))}
            />
            <SummaryRow
              label="Current volume"
              value={`${answers.currentRunDaysPerWeek ?? 0} days · ${answers.currentWeeklyKm ?? 0} km / week`}
              onEdit={onEditStep && (() => onEditStep('runDaysCount'))}
            />
            <SummaryRow
              label="Strength"
              value={`${answers.strengthSessionsPerWeek ?? 0} × ${answers.sessionLengthMin ?? 45}min · ${(answers.strengthDays ?? []).map((d) => DAY_LABELS[d]).join(', ') || '—'}`}
              onEdit={onEditStep && (() => onEditStep('strengthCount'))}
            />
            <SummaryRow
              label="Mobility"
              value={
                (answers.mobilitySessionsPerWeek ?? 0) === 0
                  ? 'Skipped'
                  : `${answers.mobilitySessionsPerWeek} / week · ${(answers.mobilityDays ?? []).map((d) => DAY_LABELS[d]).join(', ') || '—'}`
              }
              onEdit={onEditStep && (() => onEditStep('mobilityCount'))}
            />
            {(answers.mobilitySessionsPerWeek ?? 0) > 0 && Object.keys(answers.mobilityWeights ?? {}).length > 0 && (
              <SummaryRow
                label="Mobility focus"
                value={Object.entries(answers.mobilityWeights ?? {})
                  .map(([k, v]) => `${MOBILITY_FOCUS_LABELS[k] ?? k} (${v})`)
                  .join(', ')}
                onEdit={onEditStep && (() => onEditStep('mobilityFocus'))}
              />
            )}
            {answers.raceDate && (
              <SummaryRow
                label="Race"
                value={`${answers.raceName ?? 'Race'} · ${answers.raceDate}`}
                onEdit={onEditStep && (() => onEditStep('raceDetails'))}
              />
            )}
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

interface PreviewBlock {
  id: string;
  block_type: string;
  target_pace_label: string | null;
  target_pace: string | null;
  muscle_group: string | null;
  exercise_name: string;
}

interface PreviewSession {
  id: string;
  session_name: string;
  discipline: string;
  day_of_week: number;
  duration_min: number | null;
  distance_km: number | null;
  intensity: string | null;
  blocks: PreviewBlock[];
}

/**
 * Shown after a successful generate-plan call instead of navigating straight
 * to /schedule. Fetches week 1's planned_sessions + session_blocks so the
 * athlete sees real plan content (not just a toast) before leaving the
 * wizard — session_blocks was previously write-only from this flow.
 */
function GeneratedPlanPreview({
  plan,
  onContinue,
}: {
  plan: { planId: string; planName: string; totalWeeks: number; sessionsCreated: number };
  onContinue: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<PreviewSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: version } = await supabase
        .from('plan_versions')
        .select('id')
        .eq('plan_id', plan.planId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!version) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data: weekOne } = await supabase
        .from('planned_sessions')
        .select('id, session_name, discipline, day_of_week, duration_min, distance_km, intensity')
        .eq('plan_version_id', version.id)
        .eq('week_number', 1)
        .order('day_of_week', { ascending: true })
        .order('order_index', { ascending: true });

      const sessionIds = (weekOne ?? []).map((s) => s.id);
      let blocksBySession: Record<string, PreviewBlock[]> = {};
      if (sessionIds.length > 0) {
        const { data: blocks } = await supabase
          .from('session_blocks')
          .select('id, session_id, block_type, target_pace_label, target_pace, muscle_group, exercise_name')
          .in('session_id', sessionIds)
          .order('order_index', { ascending: true });
        blocksBySession = ((blocks ?? []) as (PreviewBlock & { session_id: string })[]).reduce(
          (acc, b) => {
            (acc[b.session_id] ??= []).push(b);
            return acc;
          },
          {} as Record<string, PreviewBlock[]>,
        );
      }

      if (!cancelled) {
        setSessions((weekOne ?? []).map((s) => ({ ...s, blocks: blocksBySession[s.id] ?? [] })));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plan.planId]);

  return (
    <StepShell title="Plan created" subtitle={`"${plan.planName}" · ${plan.totalWeeks} weeks · ${plan.sessionsCreated} sessions`}>
      <div className="space-y-4">
        <Card className="glass border-success/30 overflow-hidden">
          <div className="h-1 bg-success" />
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-success shrink-0" />
            <div>
              <p className="font-display font-bold text-sm">Your plan is ready</p>
              <p className="text-xs text-muted-foreground">Here's a preview of week 1 before you head to your schedule.</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Week 1</Label>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Preview unavailable — your full schedule is ready to view.</p>
          ) : (
            sessions.map((s) => {
              const disc = getDiscipline(s.discipline);
              const DiscIcon = disc.icon;
              const paceLabel = s.blocks.find((b) => b.target_pace_label || b.target_pace);
              return (
                <Card key={s.id} className="glass overflow-hidden">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${disc.color}`}>
                      <DiscIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.session_name}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                        <span>{dayLabels[s.day_of_week - 1] ?? ''}</span>
                        <span>· {disc.label}</span>
                        {s.duration_min && <span>· {s.duration_min} min</span>}
                        {s.distance_km && <span>· {s.distance_km} km</span>}
                        {s.intensity && <span>· {formatIntensity(s.intensity)}</span>}
                        {paceLabel && <span>· {paceLabel.target_pace_label ?? paceLabel.target_pace}</span>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Button onClick={onContinue} className="w-full gradient-hyrox" size="lg">
          View full schedule
        </Button>
      </div>
    </StepShell>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex justify-between items-center gap-3 border-b border-border/40 last:border-0 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-right">{value}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${label}`}
            className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </span>
    </div>
  );
}

function riskStyles(level?: string) {
  switch ((level ?? '').toLowerCase()) {
    case 'low':
      return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    case 'moderate':
    case 'medium':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    case 'high':
      return 'bg-red-500/10 text-red-500 border-red-500/30';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function PredictionView({ prediction }: { prediction: any }) {
  // Fallback for plain-string predictions
  if (typeof prediction === 'string') {
    return <p className="text-sm text-foreground whitespace-pre-wrap">{prediction}</p>;
  }

  const {
    predictedTime,
    confidence,
    targetFeedback,
    riskLevel,
    injuryRisk,
    recommendations,
  } = prediction ?? {};

  const recs: string[] = Array.isArray(recommendations)
    ? recommendations
    : typeof recommendations === 'string'
      ? [recommendations]
      : [];

  return (
    <div className="space-y-3">
      {(predictedTime || confidence || riskLevel) && (
        <div className="grid grid-cols-2 gap-2">
          {predictedTime && (
            <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Predicted Time</p>
              <p className="text-lg font-mono font-bold text-primary">{predictedTime}</p>
            </div>
          )}
          {(confidence || riskLevel) && (
            <div className="rounded-lg p-3 border border-border bg-muted/20 space-y-1.5">
              {confidence && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Confidence</p>
                  <p className="text-sm font-medium">{confidence}</p>
                </div>
              )}
              {riskLevel && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Risk</p>
                  <span className={`inline-block text-xs font-semibold uppercase px-2 py-0.5 rounded border ${riskStyles(riskLevel)}`}>
                    {riskLevel}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {targetFeedback && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target Feedback</p>
          <p className="text-sm leading-relaxed">{targetFeedback}</p>
        </div>
      )}

      {injuryRisk && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Injury Risk</p>
          <p className="text-sm leading-relaxed">{injuryRisk}</p>
        </div>
      )}

      {recs.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Recommendations</p>
          <ul className="space-y-1.5">
            {recs.map((r, i) => (
              <li key={i} className="text-sm leading-relaxed flex gap-2">
                <span className="text-primary mt-1">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
