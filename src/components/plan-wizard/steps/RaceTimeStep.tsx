import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmtTime, DISTANCE_LABELS, type RaceDistance, type WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

const DISTANCES: RaceDistance[] = ['5k', '10k', 'half', 'marathon', 'hyrox', 'other'];

function parseHMS(value: string): number | null {
  if (!value.includes(':')) return null;
  const parts = value.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

export default function RaceTimeStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const distance = answers.raceDistance ?? '10k';
  const [raw, setRaw] = useState<string>(answers.raceTimeSeconds ? fmtTime(answers.raceTimeSeconds) : '');

  // Keep local input in sync if answers change externally (e.g. navigation back)
  useEffect(() => {
    if (answers.raceTimeSeconds && !raw) setRaw(fmtTime(answers.raceTimeSeconds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers.raceTimeSeconds]);

  return (
    <StepShell
      title="What's your current race time?"
      subtitle="Your most recent or best — we'll use it to set training paces."
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Distance</Label>
          <Select value={distance} onValueChange={(v) => update({ raceDistance: v as RaceDistance })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DISTANCES.map((d) => <SelectItem key={d} value={d}>{DISTANCE_LABELS[d]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Time (h:mm:ss or mm:ss)</Label>
          <Input
            value={raw}
            inputMode="numeric"
            onChange={(e) => {
              const v = e.target.value;
              setRaw(v);
              const secs = parseHMS(v);
              update({ raceTimeSeconds: secs ?? undefined, raceDistance: distance });
            }}
            placeholder="e.g. 50:00 or 1:45:00"
          />
        </div>
        {answers.raceTimeSeconds ? (
          <p className="text-sm text-muted-foreground">
            You ran <span className="font-mono font-bold text-primary">{fmtTime(answers.raceTimeSeconds)}</span> over {DISTANCE_LABELS[distance]}.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Format examples: <code>50:00</code>, <code>1:45:00</code>.</p>
        )}
      </div>
    </StepShell>
  );
}
