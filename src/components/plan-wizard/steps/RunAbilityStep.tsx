import type { AbilityLevel, WizardAnswers } from '../wizardTypes';
import { ChoiceCard, StepShell } from './_shared';

const LEVELS: { value: AbilityLevel; title: string; description: string }[] = [
  { value: 'beginner', title: 'Beginner', description: 'New to running, or coming back. 5K feels long; pace by feel.' },
  { value: 'intermediate', title: 'Intermediate', description: 'Comfortable with 10K; have completed structured training before.' },
  { value: 'advanced', title: 'Advanced', description: 'Sub-50 10K / sub-1:50 half. Familiar with intervals + tempo work.' },
  { value: 'elite', title: 'Elite', description: 'Sub-40 10K / sub-1:30 half. Race regularly with structured periodization.' },
];

export default function RunAbilityStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  return (
    <StepShell title="How would you rate your running?" subtitle="Pick the tier that fits today — not what you used to be.">
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
