import type { AbilityLevel, WizardAnswers } from '../wizardTypes';
import { ChoiceCard, StepShell } from './_shared';

import { useTranslation } from 'react-i18next';
const LEVELS: { value: AbilityLevel; title: string; description: string }[] = [
  { value: 'beginner', title: 'Beginner', description: 'New to lifting, or returning. Body-weight and light dumbbells.' },
  { value: 'intermediate', title: 'Intermediate', description: '6+ months consistent training. Comfortable with barbell basics.' },
  { value: 'advanced', title: 'Advanced', description: 'Years of structured strength work. Squat ≥1.5× BW, deadlift ≥2× BW.' },
  { value: 'elite', title: 'Elite', description: 'Competitive strength athlete or hybrid coach-level loads.' },
];

export default function StrengthAbilityStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const { t } = useTranslation();
  return (
    <StepShell title={t('auto.k246')} subtitle={t('auto.k568')}>
      <div className="grid gap-3">
        {LEVELS.map((l) => (
          <ChoiceCard
            key={l.value}
            selected={answers.strengthAbility === l.value}
            onClick={() => update({ strengthAbility: l.value })}
            title={l.title}
            description={l.description}
          />
        ))}
      </div>
    </StepShell>
  );
}
