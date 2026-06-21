// Hand-coded concurrent-training interference (Hickson 1980-informed) and
// TSB-driven intensity/volume adjustment logic for the periodization engine.
// Deliberately not Lovable-prompted — incorrect rules here would silently
// misadvise athletes on training safety.

export interface SessionLite {
  week_number: number;
  day_of_week: number;
  discipline: string;
  intensity: string | null;
}

const HIGH_INTENSITY = ["hard", "race_pace", "max_effort"];
const HARD_ENDURANCE_DISCIPLINES = ["run", "bike", "rowing", "skierg", "stairs"];
const STRENGTH_DISCIPLINES = ["strength", "hyrox_station"];

export interface InterferenceConflict {
  weekNumber: number;
  dayA: number;
  dayB: number;
  conflictType: "same_day" | "adjacent_day_high_high";
  reasonDetails: string;
}

function isHardEndurance(s: SessionLite): boolean {
  return HARD_ENDURANCE_DISCIPLINES.includes(s.discipline) && HIGH_INTENSITY.includes(s.intensity || "");
}

function isStrength(s: SessionLite): boolean {
  return STRENGTH_DISCIPLINES.includes(s.discipline);
}

export function detectInterferenceConflicts(sessions: SessionLite[]): InterferenceConflict[] {
  const conflicts: InterferenceConflict[] = [];
  const weeks = [...new Set(sessions.map((s) => s.week_number))];

  for (const week of weeks) {
    const weekSessions = sessions.filter((s) => s.week_number === week);
    const byDay = new Map<number, SessionLite[]>();
    for (const s of weekSessions) {
      byDay.set(s.day_of_week, [...(byDay.get(s.day_of_week) || []), s]);
    }

    for (const [day, daySessions] of byDay) {
      const hasHardEndurance = daySessions.some(isHardEndurance);
      const hasStrength = daySessions.some(isStrength);
      if (hasHardEndurance && hasStrength) {
        conflicts.push({
          weekNumber: week,
          dayA: day,
          dayB: day,
          conflictType: "same_day",
          reasonDetails: `Week ${week}, day ${day}: hard endurance session paired with strength/station work on the same day (Hickson interference window).`,
        });
      }
    }

    const days = [...byDay.keys()].sort((a, b) => a - b);
    for (let i = 0; i < days.length - 1; i++) {
      const dayA = days[i];
      const dayB = days[i + 1];
      if (dayB - dayA !== 1) continue;
      const aHigh = (byDay.get(dayA) || []).some((s) => HIGH_INTENSITY.includes(s.intensity || ""));
      const bHigh = (byDay.get(dayB) || []).some((s) => HIGH_INTENSITY.includes(s.intensity || ""));
      if (aHigh && bHigh) {
        conflicts.push({
          weekNumber: week,
          dayA,
          dayB,
          conflictType: "adjacent_day_high_high",
          reasonDetails: `Week ${week}: high-intensity sessions on consecutive days ${dayA} and ${dayB} with no easy/rest day between.`,
        });
      }
    }
  }

  return conflicts;
}

export interface TsbAdjustment {
  intensityCapPct: number;
  volumeCapPct: number;
  directive: string;
}

export function tsbAdjustmentFactor(tsb: number): TsbAdjustment {
  if (tsb >= 5) {
    return { intensityCapPct: 100, volumeCapPct: 100, directive: "Athlete is fresh — no reduction needed." };
  }
  if (tsb >= -10) {
    return { intensityCapPct: 100, volumeCapPct: 100, directive: "Neutral form — proceed as planned." };
  }
  if (tsb >= -20) {
    return {
      intensityCapPct: 80,
      volumeCapPct: 90,
      directive: "Athlete is fatigued — cap high-intensity sessions, reduce volume ~10%.",
    };
  }
  return {
    intensityCapPct: 50,
    volumeCapPct: 75,
    directive: "High fatigue risk — avoid max-effort/race-pace sessions this week, reduce volume ~25%.",
  };
}

const INTENSITY_ORDER = ["easy", "moderate", "hard", "race_pace", "max_effort"];

export function downgradeIntensity(intensity: string | null): string | null {
  if (!intensity) return intensity;
  const idx = INTENSITY_ORDER.indexOf(intensity);
  if (idx <= 0) return intensity;
  return INTENSITY_ORDER[idx - 1];
}
