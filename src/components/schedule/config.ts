import { useMemo } from 'react';
import {
  Activity, Bike, Footprints, Waves, Wind, Dumbbell,
  StretchHorizontal, Wrench, Target, Zap, HelpCircle
} from 'lucide-react';

export const disciplineConfig: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  run: { label: 'Run', icon: Footprints, color: 'text-blue-500 bg-blue-500/10' },
  bike: { label: 'Bike', icon: Bike, color: 'text-emerald-500 bg-emerald-500/10' },
  rowing: { label: 'Row', icon: Waves, color: 'text-cyan-500 bg-cyan-500/10' },
  skierg: { label: 'SkiErg', icon: Wind, color: 'text-sky-500 bg-sky-500/10' },
  strength: { label: 'Strength', icon: Dumbbell, color: 'text-amber-500 bg-amber-500/10' },
  hyrox_station: { label: 'HYROX', icon: Target, color: 'text-primary bg-primary/10' },
  mobility: { label: 'Mobility', icon: StretchHorizontal, color: 'text-purple-500 bg-purple-500/10' },
  prehab: { label: 'Prehab', icon: Activity, color: 'text-teal-500 bg-teal-500/10' },
  accessories: { label: 'Accessories', icon: Wrench, color: 'text-slate-500 bg-slate-500/10' },
  stairs: { label: 'Stairs', icon: Zap, color: 'text-yellow-500 bg-yellow-500/10' },
  custom: { label: 'Custom', icon: HelpCircle, color: 'text-muted-foreground bg-muted' },
};

export const intensityConfig: Record<string, { label: string; class: string; dot: string }> = {
  easy: { label: 'Easy', class: 'bg-success/10 text-success border-success/20', dot: 'bg-success' },
  moderate: { label: 'Moderate', class: 'bg-blue-500/10 text-blue-500 border-blue-500/20', dot: 'bg-blue-500' },
  hard: { label: 'Hard', class: 'bg-warning/10 text-warning border-warning/20', dot: 'bg-warning' },
  race_pace: { label: 'Race Pace', class: 'bg-primary/10 text-primary border-primary/20', dot: 'bg-primary' },
  max_effort: { label: 'Max Effort', class: 'bg-destructive/10 text-destructive border-destructive/20', dot: 'bg-destructive' },
};

export const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const dayLabelsFull = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function formatIntensity(val: string) {
  return intensityConfig[val]?.label || val.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getDiscipline(key: string) {
  return disciplineConfig[key] || disciplineConfig.custom;
}
