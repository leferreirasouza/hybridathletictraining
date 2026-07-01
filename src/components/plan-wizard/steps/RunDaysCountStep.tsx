import { useState } from 'react';
import { z } from 'zod';
import { AlertTriangle, Info, ShieldCheck, TrendingUp } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';


const KM_MIN = 0;
const KM_MAX = 300; // realistic elite ceiling; anything higher is almost certainly a typo
const KM_STEP = 0.5;

const kmSchema = z
  .number({ invalid_type_error: 'Enter a number' })
  .finite('Enter a valid number')
  .min(KM_MIN, `Must be at least ${KM_MIN} km`)
  .max(KM_MAX, `Must be at most ${KM_MAX} km`)
  .multipleOf(KM_STEP, `Use increments of ${KM_STEP} km`);

export default function RunDaysCountStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const currentDays = answers.currentRunDaysPerWeek ?? 0;
  const currentKm = answers.currentWeeklyKm ?? 0;
  const target = answers.runDaysPerWeek ?? 3;

  const [kmRaw, setKmRaw] = useState<string>(currentKm ? String(currentKm) : '');
  const [kmError, setKmError] = useState<string | null>(null);

  const handleKmChange = (raw: string) => {
    // Numeric-only: strip anything that isn't a digit or decimal separator.
    const cleaned = raw.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
    setKmRaw(cleaned);

    if (cleaned === '') {
      setKmError(null);
      update({ currentWeeklyKm: 0 });
      return;
    }

    const parsed = Number(cleaned);
    const result = kmSchema.safeParse(parsed);
    if (!result.success) {
      setKmError(result.error.issues[0]?.message ?? 'Invalid value');
      return;
    }
    setKmError(null);
    update({ currentWeeklyKm: result.data });
  };

  // Estimate implied target volume: keep current avg km/session, scale by target days.
  // Fall back to a conservative 5 km/session when the athlete isn't running yet.
  const avgKmPerSession = currentDays > 0 && currentKm > 0 ? currentKm / currentDays : 5;
  const impliedTargetKm = avgKmPerSession * target;
  const volumeOvershoot = currentKm > 0 && impliedTargetKm > currentKm * 1.1;
  const dayOvershoot = currentDays > 0 && target > currentDays + 1;

  // Safe week-1 ceiling (10%-rule) and a realistic 4-week ramp using ~10% weekly growth.
  const safeWeek1Km = currentKm > 0 ? currentKm * 1.1 : impliedTargetKm;
  const safeWeek4Km = currentKm > 0 ? currentKm * Math.pow(1.1, 4) : impliedTargetKm;


  return (
    <StepShell title="How many days a week do you want to run?" subtitle="Volume matters more than day-count — tell us both.">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Currently running (days/week)</Label>
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={7}
              step={1}
              value={currentDays}
              onChange={(e) => update({ currentRunDaysPerWeek: Math.max(0, Math.min(7, Math.round(Number(e.target.value) || 0))) })}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Current weekly volume (km)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={KM_MIN}
              max={KM_MAX}
              step={KM_STEP}
              value={kmRaw}
              onChange={(e) => handleKmChange(e.target.value)}
              onBlur={() => {
                // Snap to nearest half-km when the user leaves the field.
                if (kmRaw === '') return;
                const snapped = Math.round(Number(kmRaw) / KM_STEP) * KM_STEP;
                const clamped = Math.max(KM_MIN, Math.min(KM_MAX, snapped));
                setKmRaw(String(clamped));
                setKmError(null);
                update({ currentWeeklyKm: clamped });
              }}
              aria-invalid={!!kmError}
              className={kmError ? 'border-destructive focus-visible:ring-destructive' : undefined}
            />
            {kmError && <p className="text-[11px] text-destructive">{kmError}</p>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-3">
          Used for injury-prevention checks (10%-rule). Range: {KM_MIN}–{KM_MAX} km, in {KM_STEP} km steps.
        </p>

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label className="text-sm">Target days per week</Label>
            <span className="font-mono font-bold text-2xl text-primary">{target}</span>
          </div>
          <Slider
            min={2}
            max={7}
            step={1}
            value={[target]}
            onValueChange={([v]) => update({ runDaysPerWeek: v, runDays: undefined })}
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span>
          </div>
        </div>

        <RuleCallout
          tone={volumeOvershoot ? 'danger' : dayOvershoot ? 'warn' : 'info'}
          currentKm={currentKm}
          currentDays={currentDays}
          target={target}
          impliedTargetKm={impliedTargetKm}
          safeWeek1Km={safeWeek1Km}
          safeWeek4Km={safeWeek4Km}
          volumeOvershoot={volumeOvershoot}
          dayOvershoot={dayOvershoot}
        />

      </div>
    </StepShell>
  );
}
