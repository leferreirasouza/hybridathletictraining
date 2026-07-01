// Shared types + helpers + age-group reference table for the plan-creation wizard.
// HYROX_AGE_GROUP_AVERAGES and fmtTime are lifted verbatim from AthletePlanForm.tsx.

export type GoalType = 'hyrox' | 'general_fitness' | 'marathon' | 'custom';
export type AbilityLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type StrengthGoal = 'running_focus' | 'all_round';
export type EquipmentPresetKey = 'bodyweight_only' | 'basic_home' | 'hyrox_box' | 'full_gym';
export type EquipmentItemKey =
  | 'gym_access' | 'sled' | 'rower' | 'skierg' | 'wall_ball' | 'sandbag' | 'rope'
  | 'kettlebell' | 'barbell' | 'dumbbell' | 'pull_up_bar' | 'bench' | 'box'
  | 'resistance_band' | 'swiss_ball';

export type RaceDistance = '5k' | '10k' | 'half' | 'marathon' | 'hyrox' | 'other';

export interface WizardAnswers {
  athleteId?: string;
  goalType?: GoalType;
  runAbility?: AbilityLevel;
  raceDistance?: RaceDistance;
  raceTimeSeconds?: number;
  currentRunDaysPerWeek?: number;
  currentWeeklyKm?: number;
  runDaysPerWeek?: number;
  runDays?: number[]; // 0=Mon..6=Sun
  raceDate?: string; // yyyy-mm-dd
  raceName?: string;
  strengthAbility?: AbilityLevel;
  strengthGoal?: StrengthGoal;
  sessionLengthMin?: 30 | 45 | 60;
  strengthSessionsPerWeek?: number;
  strengthDays?: number[];
  equipment?: { preset?: EquipmentPresetKey | 'custom'; items: Record<string, boolean> };
  mobilitySessionsPerWeek?: number;
  mobilityWeights?: Record<string, number>;
  ageGroup?: string;
}

export const HYROX_AGE_GROUP_AVERAGES: Record<string, { total: number; runPerKm: number; label: string }> = {
  '16-24': { total: 5700, runPerKm: 330, label: '16-24' },
  '25-29': { total: 5400, runPerKm: 315, label: '25-29' },
  '30-34': { total: 5400, runPerKm: 315, label: '30-34' },
  '35-39': { total: 5700, runPerKm: 330, label: '35-39' },
  '40-44': { total: 6000, runPerKm: 345, label: '40-44' },
  '45-49': { total: 6300, runPerKm: 360, label: '45-49' },
  '50-54': { total: 6600, runPerKm: 375, label: '50-54' },
  '55-59': { total: 7200, runPerKm: 400, label: '55-59' },
  '60+':   { total: 7800, runPerKm: 420, label: '60+' },
};

export function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const DISTANCE_LABELS: Record<RaceDistance, string> = {
  '5k': '5K',
  '10k': '10K',
  half: 'Half Marathon',
  marathon: 'Marathon',
  hyrox: 'HYROX',
  other: 'Custom distance',
};
