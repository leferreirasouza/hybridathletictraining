// Hand-coded periodization phase model. Replaces the freeform "include a
// taper week" prompt instruction with a concrete per-week table — same
// governance tier as interferenceRules.ts: getting taper/peak timing wrong
// risks an athlete arriving at race day either undertrained or unrested.

export type Phase = "base" | "build" | "peak" | "taper";

export interface WeekPhase {
  weekNumber: number;
  phase: Phase;
  volumeMultiplier: number; // relative to the plan's target weekly volume
  intensityCap: "easy" | "moderate" | "hard" | "race_pace" | "max_effort";
}

const INTENSITY_CAP_BY_PHASE: Record<Phase, WeekPhase["intensityCap"]> = {
  base: "moderate",
  build: "hard",
  peak: "race_pace",
  taper: "moderate",
};

// Splits a plan into base/build/peak/taper blocks. Ratios are widened for
// less experienced athletes (more base, less peak intensity exposure).
export function buildPhaseSchedule(
  planWeeks: number,
  experience: string = "intermediate"
): WeekPhase[] {
  if (planWeeks <= 0) return [];

  const taperWeeks = planWeeks >= 10 ? 2 : planWeeks >= 4 ? 1 : 0;
  const remaining = planWeeks - taperWeeks;

  const peakRatio = experience === "beginner" ? 0.1 : experience === "elite" ? 0.25 : 0.2;
  const buildRatio = experience === "beginner" ? 0.4 : 0.5;

  let peakWeeks = Math.round(remaining * peakRatio);
  let buildWeeks = Math.round(remaining * buildRatio);
  let baseWeeks = remaining - peakWeeks - buildWeeks;
  if (baseWeeks < 0) {
    // Guard against rounding pushing base negative on very short plans.
    buildWeeks += baseWeeks;
    baseWeeks = 0;
  }
  if (remaining > 0 && baseWeeks === 0 && buildWeeks === 0 && peakWeeks === 0) {
    baseWeeks = remaining;
  }

  const weeks: WeekPhase[] = [];
  let weekNumber = 1;

  for (let i = 0; i < baseWeeks; i++, weekNumber++) {
    weeks.push({
      weekNumber,
      phase: "base",
      volumeMultiplier: 0.8 + (0.2 * i) / Math.max(baseWeeks - 1, 1),
      intensityCap: INTENSITY_CAP_BY_PHASE.base,
    });
  }
  for (let i = 0; i < buildWeeks; i++, weekNumber++) {
    weeks.push({
      weekNumber,
      phase: "build",
      volumeMultiplier: 1.0 + (0.1 * i) / Math.max(buildWeeks - 1, 1),
      intensityCap: INTENSITY_CAP_BY_PHASE.build,
    });
  }
  for (let i = 0; i < peakWeeks; i++, weekNumber++) {
    weeks.push({
      weekNumber,
      phase: "peak",
      volumeMultiplier: 0.95,
      intensityCap: INTENSITY_CAP_BY_PHASE.peak,
    });
  }
  for (let i = 0; i < taperWeeks; i++, weekNumber++) {
    weeks.push({
      weekNumber,
      phase: "taper",
      volumeMultiplier: taperWeeks === 2 ? (i === 0 ? 0.65 : 0.5) : 0.6,
      intensityCap: INTENSITY_CAP_BY_PHASE.taper,
    });
  }

  return weeks;
}

export function formatPhaseTable(weeks: WeekPhase[]): string {
  return weeks
    .map(
      (w) =>
        `  Week ${w.weekNumber}: ${w.phase.toUpperCase()} — volume ${Math.round(w.volumeMultiplier * 100)}% of target, intensity cap ${w.intensityCap}`
    )
    .join("\n");
}
