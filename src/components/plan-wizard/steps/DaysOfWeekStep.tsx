import { DAY_LABELS, type WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

interface Props {
  answers: WizardAnswers;
  update: (p: Partial<WizardAnswers>) => void;
  /** Which set of days we are picking; controls validation message. */
  variant: 'run' | 'strength' | 'mobility';
}

const TITLES: Record<Props['variant'], string> = {
  run: 'Which days will you run?',
  strength: 'Which days will you do strength?',
  mobility: 'Which days for mobility / technique?',
};

const OTHER_LABELS: Record<Props['variant'], string> = {
  run: 'Strength/mobility',
  strength: 'Run/mobility',
  mobility: 'Run/strength',
};

/** Shared day-of-week multiselect used for run, strength, and mobility days. */
export default function DaysOfWeekStep({ answers, update, variant }: Props) {
  const target =
    variant === 'run' ? answers.runDaysPerWeek ?? 0
      : variant === 'strength' ? answers.strengthSessionsPerWeek ?? 0
      : answers.mobilitySessionsPerWeek ?? 0;
  const selected =
    variant === 'run' ? answers.runDays ?? []
      : variant === 'strength' ? answers.strengthDays ?? []
      : answers.mobilityDays ?? [];
  const otherSet =
    variant === 'run' ? [...(answers.strengthDays ?? []), ...(answers.mobilityDays ?? [])]
      : variant === 'strength' ? [...(answers.runDays ?? []), ...(answers.mobilityDays ?? [])]
      : [...(answers.runDays ?? []), ...(answers.strengthDays ?? [])];

  const title = TITLES[variant];
  const subtitle = `Pick exactly ${target} day${target === 1 ? '' : 's'}.`;

  const toggle = (d: number) => {
    const has = selected.includes(d);
    let next = has ? selected.filter((x) => x !== d) : [...selected, d];
    if (!has && next.length > target) next = next.slice(-target);
    if (variant === 'run') update({ runDays: next });
    else if (variant === 'strength') update({ strengthDays: next });
    else update({ mobilityDays: next });
  };

  return (
    <StepShell title={title} subtitle={subtitle}>
      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label, i) => {
          const isSelected = selected.includes(i);
          const isOther = otherSet.includes(i) && !isSelected;
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={`aspect-square rounded-xl border text-sm font-bold transition-colors ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : isOther
                    ? 'bg-muted/40 border-border text-muted-foreground'
                    : 'border-border hover:border-primary/50'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Selected {selected.length} / {target}
        {otherSet.length > 0 && ` · ${OTHER_LABELS[variant]} days shown in grey`}
      </p>
    </StepShell>
  );
}
