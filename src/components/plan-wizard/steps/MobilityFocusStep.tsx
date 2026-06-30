import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import type { WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

const FOCI: { key: string; label: string; description: string }[] = [
  { key: 'mobility_recovery', label: 'Mobility / recovery', description: 'Soft-tissue, breath work, low-intensity flexibility.' },
  { key: 'skill_drills', label: 'Skill drills', description: 'HYROX station technique — sled, wall balls, burpees.' },
  { key: 'rehab', label: 'Rehab / prehab', description: 'Targeted work for niggles and injury prevention.' },
  { key: 'run_mechanics', label: 'Run mechanics', description: 'Form drills, cadence work, plyometrics.' },
];

export default function MobilityFocusStep({ answers, update }: { answers: WizardAnswers; update: (p: Partial<WizardAnswers>) => void }) {
  const weights = answers.mobilityWeights ?? {};

  const setWeight = (key: string, value: number) => {
    const next = { ...weights };
    if (value === 0) delete next[key];
    else next[key] = value;
    update({ mobilityWeights: next });
  };

  const total = Object.values(weights).reduce((s, n) => s + n, 0);

  return (
    <StepShell
      title="What should mobility sessions focus on?"
      subtitle="Set a weighting for each — higher = more sessions of that type."
    >
      <div className="space-y-5">
        {FOCI.map((f) => {
          const v = weights[f.key] ?? 0;
          return (
            <div key={f.key} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <Label className="text-sm">{f.label}</Label>
                  <p className="text-[11px] text-muted-foreground">{f.description}</p>
                </div>
                <span className="font-mono font-bold text-sm text-primary">{v}</span>
              </div>
              <Slider min={0} max={5} step={1} value={[v]} onValueChange={([n]) => setWeight(f.key, n)} />
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground">
          {total === 0
            ? 'No focus selected — mobility sessions will be general flexibility.'
            : `Relative weighting total: ${total}.`}
        </p>
      </div>
    </StepShell>
  );
}
