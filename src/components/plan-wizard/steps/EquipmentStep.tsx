import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StepShell } from './_shared';
import type {
  EquipmentItemKey,
  EquipmentPresetKey,
  WizardAnswers,
} from '../wizardTypes';

interface Props {
  answers: WizardAnswers;
  update: (p: Partial<WizardAnswers>) => void;
}

const ITEM_KEYS: EquipmentItemKey[] = [
  'gym_access', 'sled', 'rower', 'skierg', 'wall_ball', 'sandbag', 'rope',
  'kettlebell', 'barbell', 'dumbbell', 'pull_up_bar', 'bench', 'box',
  'resistance_band', 'swiss_ball',
];

const ITEM_LABELS: Record<EquipmentItemKey, string> = {
  gym_access: 'Gym access',
  sled: 'Sled',
  rower: 'Rower',
  skierg: 'SkiErg',
  wall_ball: 'Wall ball',
  sandbag: 'Sandbag',
  rope: 'Rope',
  kettlebell: 'Kettlebell',
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  pull_up_bar: 'Pull-up bar',
  bench: 'Bench',
  box: 'Box',
  resistance_band: 'Resistance bands',
  swiss_ball: 'Swiss ball',
};

interface PresetDef {
  key: EquipmentPresetKey;
  title: string;
  description: string;
  items: EquipmentItemKey[];
}

const PRESETS: PresetDef[] = [
  {
    key: 'bodyweight_only',
    title: 'Bodyweight Only',
    description: 'No equipment needed',
    items: [],
  },
  {
    key: 'basic_home',
    title: 'Basic Home Gym',
    description: 'Dumbbells, bench, pull-up bar, bands',
    items: ['dumbbell', 'bench', 'pull_up_bar', 'resistance_band'],
  },
  {
    key: 'hyrox_box',
    title: 'HYROX / CrossFit Box',
    description: 'Full HYROX kit + barbell + KB',
    items: [
      'gym_access', 'sled', 'rower', 'skierg', 'wall_ball', 'sandbag',
      'rope', 'kettlebell', 'barbell', 'box',
    ],
  },
  {
    key: 'full_gym',
    title: 'Full Gym',
    description: 'Everything, including machines',
    items: [
      'gym_access', 'sled', 'rower', 'skierg', 'wall_ball', 'sandbag', 'rope',
      'kettlebell', 'barbell', 'dumbbell', 'pull_up_bar', 'bench', 'box',
      'resistance_band', 'swiss_ball',
    ],
  },
];

const itemsFromPreset = (keys: EquipmentItemKey[]): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const k of ITEM_KEYS) out[k] = keys.includes(k);
  return out;
};

/**
 * Reads the saved equipment value defensively: legacy rows are a flat
 * { gym_access: bool, ... } shape; new rows are { preset, items: {...} }.
 */
const readSavedItems = (eq: WizardAnswers['equipment'] | undefined): Record<string, boolean> => {
  if (!eq) return {};
  // New shape
  if ('items' in eq && eq.items && typeof eq.items === 'object' && !Array.isArray(eq.items)) {
    return eq.items as Record<string, boolean>;
  }
  // Legacy flat shape — strip non-bool fields
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(eq as Record<string, unknown>)) {
    if (typeof v === 'boolean') out[k] = v;
  }
  return out;
};

export default function EquipmentStep({ answers, update }: Props) {
  const initialItems = useMemo(() => readSavedItems(answers.equipment), [answers.equipment]);
  const selectedPreset = answers.equipment?.preset;
  const items: Record<string, boolean> = answers.equipment?.items ?? initialItems;

  const [open, setOpen] = useState(selectedPreset === 'custom');

  const selectPreset = (p: PresetDef) => {
    update({ equipment: { preset: p.key, items: itemsFromPreset(p.items) } });
  };

  const toggleItem = (key: EquipmentItemKey, checked: boolean) => {
    update({
      equipment: {
        preset: 'custom',
        items: { ...items, [key]: checked },
      },
    });
  };

  return (
    <StepShell
      title="Equipment"
      subtitle="Pick a preset, or open the list to fine-tune what you actually have."
    >
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map((p) => {
          const selected = selectedPreset === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => selectPreset(p)}
              className={`text-left rounded-xl border p-4 transition-colors min-h-[112px] flex flex-col gap-1 ${
                selected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display font-bold text-sm leading-tight">{p.title}</p>
                {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{p.description}</p>
            </button>
          );
        })}
      </div>

      <Collapsible open={open} onOpenChange={setOpen} className="mt-6">
        <CollapsibleTrigger className="w-full flex items-center justify-between rounded-xl border border-border p-3 text-sm font-medium hover:border-primary/50 transition-colors">
          <span>
            I want to be specific
            {selectedPreset === 'custom' && (
              <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">custom</span>
            )}
          </span>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-border p-4">
            {ITEM_KEYS.map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer py-1"
              >
                <Checkbox
                  checked={!!items[key]}
                  onCheckedChange={(c) => toggleItem(key, !!c)}
                />
                <span className="text-sm">{ITEM_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </StepShell>
  );
}
