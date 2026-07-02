import { ReactNode } from 'react';

/** Shared wrapper that gives every step the same headline + body layout. */
export function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h2 className="text-2xl font-display font-bold">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </header>
      <div>{children}</div>
    </div>
  );
}

/** Big tappable selection card used across most "pick one" steps. */
export function ChoiceCard({
  selected,
  onClick,
  title,
  description,
  badge,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full text-left rounded-xl border p-4 transition-colors ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-border hover:border-primary/50'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-display font-bold">{title}</p>
        {badge && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wider">
            {badge}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
    </button>
  );
}
