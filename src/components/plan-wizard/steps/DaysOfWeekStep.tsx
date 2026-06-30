import { DAY_LABELS, type WizardAnswers } from '../wizardTypes';
import { StepShell } from './_shared';

interface Props {
  answers: WizardAnswers;
  update: (p: Partial<WizardAnswers>) => void;
  /** Which set of days we are picking; controls validation message. */
  variant: 'run' | 'strength';
}

/** Shared day-of-week multiselect used for both run and strength days. */
export default function DaysOfWeekStep({ answers, update, variant }: Props) {
  const target = variant === 'run' ? answers.runDaysPerWeek ?? 0 : answers.strengthSessionsPerWeek ?? 0;
  const selected = variant === 'run' ? answers.runDays ?? [] : answers.strengthDays ?? [];
  const otherSet = variant === 'run' ? answers.strengthDays ?? [] : answers.runDays ?? [];

  const title = variant === 'run' ? 'Which days will you run?' : 'Which days will you do strength?';
  const subtitle = `Pick exactly ${target} day${target === 1 ? '' : 's'}.`;

  const toggle = (d: number) => {
    const has = selected.includes(d);
    let next = has ? selected.filter((x) => x !== d) : [...selected, d];
    if (!has && next.length > target) next = next.slice(-target);
    if (variant === 'run') update({ runDays: next });
    else update({ strengthDays: next });
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
        {otherSet.length > 0 && ` · ${variant === 'run' ? 'Strength' : 'Run'} days shown in grey`}
      </p>
    </StepShell>
  );
}
