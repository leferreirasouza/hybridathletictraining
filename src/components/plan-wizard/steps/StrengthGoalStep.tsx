import type { StrengthGoal, WizardAnswers } from '../wizardTypes';
import { ChoiceCard, StepShell } from './_shared';

const OPTIONS: { value: StrengthGoal; title: string; description: string; badge?: string }[] = [
  {
    value: 'running_focus',
    title: 'Running focus',
    description: 'Strength to support runs — less hypertrophy, more durability and economy.',
    badge: 'Recommended for races',
  },
  {
    value: 'all_round',
    title: 'All-round strength',
    description: 'Balanced upper/lower hypertrophy + power, alongside endurance.',
  },
];

export default function StrengthGoalStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  return (
    <StepShell title="What's your strength goal?" subtitle="Drives muscle-group emphasis and rep schemes.">
      <div className="grid gap-3">
        {OPTIONS.map((o) => (
          <ChoiceCard
            key={o.value}
            selected={answers.strengthGoal === o.value}
            onClick={() => update({ strengthGoal: o.value })}
            title={o.title}
            description={o.description}
            badge={o.badge}
          />
        ))}
      </div>
    </StepShell>
  );
}
