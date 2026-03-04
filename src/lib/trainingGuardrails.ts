// Training Load Guardrails — Evidence-based safety parameters
// Sources: ACSM guidelines, 10% rule, acute:chronic workload ratio research

export const GUARDRAILS = {
  // Weekly mileage progression cap (max % increase week-over-week)
  MAX_WEEKLY_MILEAGE_INCREASE_PCT: 10,

  // Maximum weekly running distance by experience (km)
  MAX_WEEKLY_RUN_KM: {
    beginner: 30,
    intermediate: 55,
    advanced: 80,
    elite: 120,
  } as Record<string, number>,

  // Maximum training sessions per week (across ALL plans)
  MAX_WEEKLY_SESSIONS: {
    beginner: 5,
    intermediate: 7,
    advanced: 10,
    elite: 12,
  } as Record<string, number>,

  // Maximum weekly training duration in minutes
  MAX_WEEKLY_DURATION_MIN: {
    beginner: 300,
    intermediate: 480,
    advanced: 660,
    elite: 900,
  } as Record<string, number>,

  // Maximum hard/race-pace/max-effort sessions per week
  MAX_HIGH_INTENSITY_PER_WEEK: {
    beginner: 2,
    intermediate: 3,
    advanced: 4,
    elite: 5,
  } as Record<string, number>,

  // Minimum strength sessions per week (injury prevention)
  MIN_STRENGTH_PER_WEEK: 1,

  // Maximum consecutive training days without rest
  MAX_CONSECUTIVE_DAYS: 5,

  // Intensity distribution (polarized model — 80/20)
  TARGET_EASY_PCT: 80, // % of sessions should be easy/moderate
  TARGET_HARD_PCT: 20, // % of sessions should be hard+

  // Disciplines counted as "high intensity"
  HIGH_INTENSITY_LEVELS: ['hard', 'race_pace', 'max_effort'] as string[],

  // Running disciplines
  RUN_DISCIPLINES: ['run'] as string[],

  // Strength disciplines
  STRENGTH_DISCIPLINES: ['strength', 'accessories', 'prehab'] as string[],
} as const;

export type RiskLevel = 'safe' | 'caution' | 'danger';

export interface WeeklyLoadMetrics {
  weekNumber: number;
  totalSessions: number;
  totalRunKm: number;
  totalDurationMin: number;
  highIntensitySessions: number;
  strengthSessions: number;
  consecutiveTrainingDays: number;
  easyPct: number;
  hardPct: number;
}

export interface LoadWarning {
  metric: string;
  label: string;
  current: number;
  limit: number;
  unit: string;
  risk: RiskLevel;
}

export function analyzeWeeklyLoad(
  sessions: Array<{
    week_number: number;
    day_of_week: number;
    discipline: string;
    intensity?: string | null;
    distance_km?: number | null;
    duration_min?: number | null;
  }>,
  weekNumber: number,
  experience: string = 'intermediate'
): { metrics: WeeklyLoadMetrics; warnings: LoadWarning[] } {
  const weekSessions = sessions.filter(s => s.week_number === weekNumber);
  const prevWeekSessions = sessions.filter(s => s.week_number === weekNumber - 1);

  const totalSessions = weekSessions.length;
  const totalRunKm = weekSessions
    .filter(s => GUARDRAILS.RUN_DISCIPLINES.includes(s.discipline))
    .reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
  const totalDurationMin = weekSessions.reduce((sum, s) => sum + (Number(s.duration_min) || 0), 0);
  const highIntensitySessions = weekSessions.filter(s =>
    GUARDRAILS.HIGH_INTENSITY_LEVELS.includes(s.intensity || '')
  ).length;
  const strengthSessions = weekSessions.filter(s =>
    GUARDRAILS.STRENGTH_DISCIPLINES.includes(s.discipline)
  ).length;

  // Consecutive training days
  const trainingDays = new Set(weekSessions.map(s => s.day_of_week));
  let maxConsecutive = 0;
  let current = 0;
  for (let d = 1; d <= 7; d++) {
    if (trainingDays.has(d)) { current++; maxConsecutive = Math.max(maxConsecutive, current); }
    else { current = 0; }
  }

  // Intensity distribution
  const easyCount = weekSessions.filter(s =>
    !GUARDRAILS.HIGH_INTENSITY_LEVELS.includes(s.intensity || '') && s.intensity
  ).length;
  const totalWithIntensity = weekSessions.filter(s => s.intensity).length;
  const easyPct = totalWithIntensity > 0 ? Math.round((easyCount / totalWithIntensity) * 100) : 100;
  const hardPct = 100 - easyPct;

  const metrics: WeeklyLoadMetrics = {
    weekNumber, totalSessions, totalRunKm, totalDurationMin,
    highIntensitySessions, strengthSessions, consecutiveTrainingDays: maxConsecutive,
    easyPct, hardPct,
  };

  // Generate warnings
  const warnings: LoadWarning[] = [];
  const exp = experience || 'intermediate';

  const maxSessions = GUARDRAILS.MAX_WEEKLY_SESSIONS[exp] || 7;
  if (totalSessions > maxSessions) {
    warnings.push({ metric: 'sessions', label: 'Weekly Sessions', current: totalSessions, limit: maxSessions, unit: '', risk: totalSessions > maxSessions + 2 ? 'danger' : 'caution' });
  }

  const maxRunKm = GUARDRAILS.MAX_WEEKLY_RUN_KM[exp] || 55;
  if (totalRunKm > maxRunKm) {
    warnings.push({ metric: 'run_km', label: 'Weekly Mileage', current: Math.round(totalRunKm * 10) / 10, limit: maxRunKm, unit: 'km', risk: totalRunKm > maxRunKm * 1.15 ? 'danger' : 'caution' });
  }

  const maxDuration = GUARDRAILS.MAX_WEEKLY_DURATION_MIN[exp] || 480;
  if (totalDurationMin > maxDuration) {
    warnings.push({ metric: 'duration', label: 'Weekly Duration', current: Math.round(totalDurationMin), limit: maxDuration, unit: 'min', risk: totalDurationMin > maxDuration * 1.15 ? 'danger' : 'caution' });
  }

  const maxHigh = GUARDRAILS.MAX_HIGH_INTENSITY_PER_WEEK[exp] || 3;
  if (highIntensitySessions > maxHigh) {
    warnings.push({ metric: 'high_intensity', label: 'High-Intensity', current: highIntensitySessions, limit: maxHigh, unit: 'sessions', risk: highIntensitySessions > maxHigh + 1 ? 'danger' : 'caution' });
  }

  if (strengthSessions < GUARDRAILS.MIN_STRENGTH_PER_WEEK) {
    warnings.push({ metric: 'strength', label: 'Strength Work', current: strengthSessions, limit: GUARDRAILS.MIN_STRENGTH_PER_WEEK, unit: 'sessions (min)', risk: 'caution' });
  }

  if (maxConsecutive > GUARDRAILS.MAX_CONSECUTIVE_DAYS) {
    warnings.push({ metric: 'consecutive', label: 'Consecutive Days', current: maxConsecutive, limit: GUARDRAILS.MAX_CONSECUTIVE_DAYS, unit: 'days', risk: 'danger' });
  }

  // Week-over-week mileage progression
  if (weekNumber > 1 && prevWeekSessions.length > 0) {
    const prevRunKm = prevWeekSessions
      .filter(s => GUARDRAILS.RUN_DISCIPLINES.includes(s.discipline))
      .reduce((sum, s) => sum + (Number(s.distance_km) || 0), 0);
    if (prevRunKm > 0) {
      const increasePct = ((totalRunKm - prevRunKm) / prevRunKm) * 100;
      if (increasePct > GUARDRAILS.MAX_WEEKLY_MILEAGE_INCREASE_PCT) {
        warnings.push({ metric: 'progression', label: 'Mileage Jump', current: Math.round(increasePct), limit: GUARDRAILS.MAX_WEEKLY_MILEAGE_INCREASE_PCT, unit: '%', risk: increasePct > 20 ? 'danger' : 'caution' });
      }
    }
  }

  if (hardPct > 30 && totalWithIntensity >= 3) {
    warnings.push({ metric: 'polarization', label: 'Hard Session %', current: hardPct, limit: GUARDRAILS.TARGET_HARD_PCT, unit: '%', risk: hardPct > 40 ? 'danger' : 'caution' });
  }

  return { metrics, warnings };
}

// Build a textual summary for the AI prompt
export function buildGuardrailPromptSection(
  existingSessions: Array<{
    week_number: number;
    day_of_week: number;
    discipline: string;
    intensity?: string | null;
    distance_km?: number | null;
    duration_min?: number | null;
  }>,
  experience: string = 'intermediate'
): string {
  if (existingSessions.length === 0) return '';

  const weeks = [...new Set(existingSessions.map(s => s.week_number))].sort((a, b) => a - b);
  const lines: string[] = [
    `\n\n⚠️ EXISTING TRAINING LOAD FROM OTHER ACTIVE PLANS:`,
    `The athlete already has ${existingSessions.length} sessions across ${weeks.length} weeks from other plans.`,
    `Experience level: ${experience}`,
    '',
  ];

  for (const w of weeks) {
    const { metrics } = analyzeWeeklyLoad(existingSessions, w, experience);
    lines.push(`Week ${w}: ${metrics.totalSessions} sessions, ${metrics.totalRunKm.toFixed(1)}km running, ${Math.round(metrics.totalDurationMin)}min total, ${metrics.highIntensitySessions} high-intensity, ${metrics.strengthSessions} strength`);
  }

  const exp = experience || 'intermediate';
  lines.push('');
  lines.push(`SAFETY LIMITS FOR ${experience.toUpperCase()} ATHLETE:`);
  lines.push(`- Max weekly running: ${GUARDRAILS.MAX_WEEKLY_RUN_KM[exp] || 55}km`);
  lines.push(`- Max weekly sessions: ${GUARDRAILS.MAX_WEEKLY_SESSIONS[exp] || 7}`);
  lines.push(`- Max weekly duration: ${GUARDRAILS.MAX_WEEKLY_DURATION_MIN[exp] || 480}min`);
  lines.push(`- Max high-intensity sessions/week: ${GUARDRAILS.MAX_HIGH_INTENSITY_PER_WEEK[exp] || 3}`);
  lines.push(`- Min strength sessions/week: ${GUARDRAILS.MIN_STRENGTH_PER_WEEK}`);
  lines.push(`- Max mileage increase week-over-week: ${GUARDRAILS.MAX_WEEKLY_MILEAGE_INCREASE_PCT}%`);
  lines.push(`- Max consecutive training days: ${GUARDRAILS.MAX_CONSECUTIVE_DAYS}`);
  lines.push('');
  lines.push(`CRITICAL: The new plan's sessions COMBINED with the existing load above must NOT exceed these limits. Reduce volume, skip overlapping days, or lower intensity where necessary. Safety > performance.`);

  return lines.join('\n');
}
