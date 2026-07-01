import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

export default function RunDaysCountStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const currentDays = answers.currentRunDaysPerWeek ?? 0;
  const currentKm = answers.currentWeeklyKm ?? 0;
  const target = answers.runDaysPerWeek ?? 3;

  // Estimate implied target volume: keep current avg km/session, scale by target days.
  // Fall back to a conservative 5 km/session when the athlete isn't running yet.
  const avgKmPerSession = currentDays > 0 && currentKm > 0 ? currentKm / currentDays : 5;
  const impliedTargetKm = avgKmPerSession * target;
  const volumeOvershoot = currentKm > 0 && impliedTargetKm > currentKm * 1.1;
  const dayOvershoot = currentDays > 0 && target > currentDays + 1;

  const warning = volumeOvershoot
    ? `Adding ${target} run days at your current per-session distance implies ~${impliedTargetKm.toFixed(0)} km/week — that's more than +10% over your current ${currentKm} km. Increasing weekly volume by more than ~10% raises injury risk.`
    : dayOvershoot
      ? `Jumping from ${currentDays} to ${target} run days/week increases injury risk. Aim for at most one more than you currently do.`
      : 'Recommended: keep weekly km growth under ~10% and add at most one more run day than you currently do.';
  const warningTone = volumeOvershoot || dayOvershoot;

  return (
    <StepShell title="How many days a week do you want to run?" subtitle="Volume matters more than day-count — tell us both.">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Currently running (days/week)</Label>
            <Input
              type="number"
              min={0}
              max={7}
              value={currentDays}
              onChange={(e) => update({ currentRunDaysPerWeek: Math.max(0, Math.min(7, Number(e.target.value))) })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Current weekly volume (km)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={currentKm}
              onChange={(e) => update({ currentWeeklyKm: Math.max(0, Number(e.target.value)) })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">Used for injury-prevention checks (10%-rule).</p>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">Target days per week</Label>
            <span className="font-mono font-bold text-2xl text-primary">{target}</span>
          </div>
          <Slider
            min={2}
            max={7}
            step={1}
            value={[target]}
            onValueChange={([v]) => update({ runDaysPerWeek: v, runDays: undefined })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span>
          </div>
        </div>

        <p className={`text-xs rounded-lg p-3 border ${warningTone ? 'bg-warning/10 border-warning/30 text-warning-foreground' : 'bg-muted/30 border-border text-muted-foreground'}`}>
          {warning}
        </p>
      </div>
    </StepShell>
  );
}
