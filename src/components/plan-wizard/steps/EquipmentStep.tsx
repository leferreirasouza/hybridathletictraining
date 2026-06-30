import { Dumbbell } from 'lucide-react';
import { StepShell } from './_shared';

/**
 * Placeholder per spec — full equipment + presets flow lands in Message 3.
 * We still let the user advance; downstream defaults to "all equipment".
 */
export default function EquipmentStep() {
  return (
    <StepShell
      title="Equipment"
      subtitle="We'll pull this from your Training Preferences for now."
    >
      <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center text-center gap-3">
        <Dumbbell className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Detailed equipment picker + presets coming in the next update.
        </p>
        <p className="text-xs text-muted-foreground">
          You can fine-tune equipment any time from <span className="font-medium">Settings → Training Preferences</span>.
        </p>
      </div>
    </StepShell>
  );
}
