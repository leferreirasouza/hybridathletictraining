import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

export default function RunDaysCountStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const current = answers.currentRunDaysPerWeek ?? 0;
  const target = answers.runDaysPerWeek ?? 3;
  const overshoot = current > 0 && target > current + 1;

  return (
    <StepShell title="How many days a week do you want to run?" subtitle="Move the slider — 2 days is the safe minimum.">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label className="text-sm">Currently running</Label>
          <Input
            type="number"
            min={0}
            max={7}
            value={current}
            onChange={(e) => update({ currentRunDaysPerWeek: Math.max(0, Math.min(7, Number(e.target.value))) })}
            className="max-w-[140px]"
          />
          <p className="text-xs text-muted-foreground">Used for injury-prevention checks.</p>
        </div>

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

        <p className={`text-xs rounded-lg p-3 border ${overshoot ? 'bg-warning/10 border-warning/30 text-warning-foreground' : 'bg-muted/30 border-border text-muted-foreground'}`}>
          {overshoot
            ? `Jumping from ${current} to ${target} run days/week increases injury risk. Aim for at most one more than you currently do.`
            : 'Recommended: add at most one more run day than you currently do, to protect against overuse injury.'}
        </p>
      </div>
    </StepShell>
  );
}
