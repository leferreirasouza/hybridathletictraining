import type { WizardAnswers } from '../wizardTypes';
import { ChoiceCard, StepShell } from './_shared';

import { useTranslation } from 'react-i18next';
const OPTIONS = [
  { value: 30 as const, title: '30 minutes', description: 'Quick, focused. Great if you train at lunch.' },
  { value: 45 as const, title: '45 minutes', description: 'Sweet spot for most athletes.', badge: 'Most popular' },
  { value: 60 as const, title: '60 minutes', description: 'Full session with mobility + accessories.', badge: 'Recommended' },
];

export default function SessionLengthStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const { t } = useTranslation();
  return (
    <StepShell title={t('auto.k241')} subtitle={t('auto.k512')}>
      <div className="grid gap-3">
        {OPTIONS.map((o) => (
          <ChoiceCard
            key={o.value}
            selected={answers.sessionLengthMin === o.value}
            onClick={() => update({ sessionLengthMin: o.value })}
            title={o.title}
            description={o.description}
            badge={o.badge}
          />
        ))}
      </div>
    </StepShell>
  );
}
