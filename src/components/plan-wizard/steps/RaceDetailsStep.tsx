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

export default function RaceDetailsStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const date = answers.raceDate ? new Date(answers.raceDate + 'T00:00:00') : undefined;
  const weeks = date ? differenceInWeeks(date, new Date()) : null;
  const tooFar = weeks !== null && weeks > 20;

  return (
    <StepShell title="When and where is your race?" subtitle="We'll periodize the plan to peak you on race day.">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Race name (optional)</Label>
          <Input
            value={answers.raceName ?? ''}
            onChange={(e) => update({ raceName: e.target.value })}
            placeholder="HYROX Munich"
          />
        </div>
        <div className="space-y-2">
          <Label>Race date</Label>
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
                That's {weeks} weeks away — beyond a typical 12–16 week build. We can start with a base/interim block now and switch to a peak block closer to race day.
              </span>
            </p>
          </div>
        )}
      </div>
    </StepShell>
  );
}
