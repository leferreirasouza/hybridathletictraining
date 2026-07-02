import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

interface Props {
  answers: WizardAnswers;
  update: (p: Partial<WizardAnswers>) => void;
  variant: 'strength' | 'mobility';
}

const COPY: Record<Props['variant'], { title: string; subtitle: string; field: keyof WizardAnswers; max: number }> = {
  strength: {
    title: 'How many strength sessions per week?',
    subtitle: 'Most athletes do best with 2–3. Set 0 to skip strength.',
    field: 'strengthSessionsPerWeek',
    max: 6,
  },
  mobility: {
    title: 'Mobility / physio sessions (optional)',
    subtitle: 'Short focused sessions — 15–30 min each. Leave at 0 to skip entirely.',
    field: 'mobilitySessionsPerWeek',
    max: 7,
  },
};

export default function SessionCountStep({ answers, update, variant }: Props) {
  const cfg = COPY[variant];
  const value = (answers[cfg.field] as number | undefined) ?? 0;

  return (
    <StepShell title={cfg.title} subtitle={cfg.subtitle}>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <Label className="text-sm">Sessions per week</Label>
          <span className="font-mono font-bold text-2xl text-primary">{value}</span>
        </div>
        <Slider
          min={0}
          max={cfg.max}
          step={1}
          value={[value]}
          onValueChange={([v]) => {
            const patch: Partial<WizardAnswers> = { [cfg.field]: v } as Partial<WizardAnswers>;
            if (variant === 'strength') patch.strengthDays = undefined;
            else patch.mobilityDays = undefined;
            update(patch);
          }}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          {Array.from({ length: cfg.max + 1 }, (_, i) => <span key={i}>{i}</span>)}
        </div>
      </div>
    </StepShell>
  );
}
