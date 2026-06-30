import type { GoalType, WizardAnswers } from '../wizardTypes';
import { ChoiceCard, StepShell } from './_shared';

const OPTIONS: { value: GoalType; title: string; description: string }[] = [
  { value: 'hyrox', title: 'HYROX race', description: '8 × 1km runs + 8 stations' },
  { value: 'general_fitness', title: 'General fitness', description: 'No race — build a strong, healthy engine' },
  { value: 'marathon', title: 'Marathon / road race', description: '5K through marathon distances' },
  { value: 'custom', title: 'Custom goal', description: 'Trail race, obstacle race, hybrid event…' },
];

export default function GoalTypeStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  return (
    <StepShell title="What's your main goal?" subtitle="We'll tailor the periodization to match.">
      <div className="grid gap-3">
        {OPTIONS.map((o) => (
          <ChoiceCard
            key={o.value}
            selected={answers.goalType === o.value}
            onClick={() => update({ goalType: o.value })}
            title={o.title}
            description={o.description}
          />
        ))}
      </div>
    </StepShell>
  );
}
