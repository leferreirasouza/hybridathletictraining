import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssigneeOptions } from '@/hooks/useAssigneeOptions';
import { useAuth } from '@/contexts/AuthContext';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

import { useTranslation } from 'react-i18next';
interface Props {
  answers: WizardAnswers;
  update: (patch: Partial<WizardAnswers>) => void;
}

export default function AthletePickerStep({ answers, update }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: options = [], isLoading } = useAssigneeOptions(true);

  // Default to the current user so the visible selection matches the stored answer.
  useEffect(() => {
    if (!answers.athleteId && user?.id) update({ athleteId: user.id });
  }, [answers.athleteId, user?.id, update]);

  return (
    <StepShell
      title={t('auto.k634')}
      subtitle={t('auto.k389')}
    >
      <Select
        value={answers.athleteId ?? user?.id ?? ''}
        onValueChange={(v) => update({ athleteId: v })}
      >
        <SelectTrigger>
          <SelectValue placeholder={isLoading ? 'Loading…' : 'Select athlete'} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.fullName}{o.id === user?.id ? ' (You)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </StepShell>
  );
}
