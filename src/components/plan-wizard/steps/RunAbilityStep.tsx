import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Activity } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LAYOFF_DAYS_THRESHOLD,
  formatPaceSeconds,
  isReturnFromLayoff,
  loadRecentTraining,
} from '@/lib/recentTraining';
import type { AbilityLevel, WizardAnswers } from '../wizardTypes';
import { ChoiceCard, StepShell } from './_shared';

const LEVELS: { value: AbilityLevel; title: string; description: string }[] = [
  { value: 'beginner', title: 'Beginner', description: 'New to running, or coming back. 5K feels long; pace by feel.' },
  { value: 'intermediate', title: 'Intermediate', description: 'Comfortable with 10K; have completed structured training before.' },
  { value: 'advanced', title: 'Advanced', description: 'Sub-50 10K / sub-1:50 half. Familiar with intervals + tempo work.' },
  { value: 'elite', title: 'Elite', description: 'Sub-40 10K / sub-1:30 half. Race regularly with structured periodization.' },
];

export default function RunAbilityStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const { user } = useAuth();
  const athleteId = (answers as any).athleteId || user?.id;
  const [prefilled, setPrefilled] = useState(false);

  const { data: recent } = useQuery({
    queryKey: ['recent-training', athleteId],
    queryFn: () => loadRecentTraining(athleteId!),
    enabled: !!athleteId,
    staleTime: 5 * 60 * 1000,
  });

  // Prefill the volume baseline from what was actually logged. The athlete can
  // still change it on the running-days step; we only seed it once.
  useEffect(() => {
    if (!recent?.hasData || prefilled) return;
    setPrefilled(true);
    const patch: Partial<WizardAnswers> = {};
    if (!(answers as any).currentWeeklyKm && recent.avgRunKm4w > 0) {
      (patch as any).currentWeeklyKm = recent.avgRunKm4w;
    }
    if (Object.keys(patch).length > 0) update(patch);
  }, [recent, prefilled, answers, update]);

  const layoff = isReturnFromLayoff(recent);

  return (
    <StepShell title="How would you rate your running?" subtitle="Pick the tier that fits today — not what you used to be.">
      {recent?.hasData && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
          <p className="text-xs font-semibold flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary" /> From your last 8 weeks
          </p>
          <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
            <div>
              <span className="text-muted-foreground">Avg run volume</span>
              <p className="font-medium">{recent.avgRunKm8w} km/week</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last 4 weeks</span>
              <p className="font-medium">{recent.avgRunKm4w} km/week</p>
            </div>
            <div>
              <span className="text-muted-foreground">Longest run</span>
              <p className="font-medium">{recent.longestRunKm} km</p>
            </div>
            <div>
              <span className="text-muted-foreground">Avg run pace</span>
              <p className="font-medium">
                {recent.avgRunPaceSecPerKm ? `${formatPaceSeconds(recent.avgRunPaceSecPerKm)}/km` : '—'}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Avg run HR</span>
              <p className="font-medium">{recent.avgRunHr ? `${recent.avgRunHr} bpm` : '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Days since last run</span>
              <p className="font-medium">{recent.daysSinceLastRun ?? '—'}</p>
            </div>
          </div>
          <div className="space-y-1 pt-1">
            <Label className="text-xs text-muted-foreground">Weekly running volume to plan from (km)</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              inputMode="decimal"
              className="h-8"
              value={(answers as any).currentWeeklyKm ?? ''}
              onChange={(e) =>
                update({ currentWeeklyKm: e.target.value === '' ? undefined : Number(e.target.value) } as Partial<WizardAnswers>)
              }
            />
            <p className="text-[11px] text-muted-foreground">
              Prefilled from your logged training. You can change it — week 1 is still capped at 1.10× your last 4 weeks.
            </p>
          </div>
        </div>
      )}

      {layoff && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs">
            No run logged in the last {LAYOFF_DAYS_THRESHOLD} days. Your plan will start with a return-to-running
            block: easier paces and a shorter long run for the first two weeks.
          </p>
        </div>
      )}

      <div className="grid gap-3">
        {LEVELS.map((l) => (
          <ChoiceCard
            key={l.value}
            selected={answers.runAbility === l.value}
            onClick={() => update({ runAbility: l.value })}
            title={l.title}
            description={l.description}
          />
        ))}
      </div>
    </StepShell>
  );
}
