import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { format, differenceInWeeks } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

import { useTranslation } from 'react-i18next';
export default function RaceDetailsStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const { t } = useTranslation();
  const date = answers.raceDate ? new Date(answers.raceDate + 'T00:00:00') : undefined;
  const weeks = date ? differenceInWeeks(date, new Date()) : null;
  const tooFar = weeks !== null && weeks > 20;

  return (
    <StepShell title={t('auto.k632')} subtitle={t('auto.k613')}>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('auto.k436')}</Label>
          <Input
            value={answers.raceName ?? ''}
            onChange={(e) => update({ raceName: e.target.value })}
            placeholder="HYROX Munich"
          />
        </div>
        <div className="space-y-2">
          <Label>{t('auto.k430')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                {date ? format(date, 'PPP') : 'Pick race date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => update({ raceDate: d ? format(d, 'yyyy-MM-dd') : undefined })}
                disabled={(d) => d < new Date()}
                initialFocus
                className={cn('p-3 pointer-events-auto')}
              />
            </PopoverContent>
          </Popover>
        </div>

        {tooFar && (
          <div className="rounded-lg p-3 border border-warning/30 bg-warning/10 text-xs space-y-2">
            <p className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <span>
                
                {t('auto.k550')} {weeks}  {t('auto.k625')}
              </span>
            </p>
          </div>
        )}
      </div>
    </StepShell>
  );
}
