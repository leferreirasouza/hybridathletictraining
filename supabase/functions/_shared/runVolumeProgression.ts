// Hand-coded weekly running-volume progression. Turns the athlete's current
// weekly km baseline into a deterministic per-week km target that respects the
// 10%-rule and the phase model's volume multipliers, then splits each week's
// km budget across the run slots assigned by sessionSlots.ts.
//
// Governance tier: same as sessionSlots/phaseModel — getting weekly volume
// evolution wrong is the single biggest injury-risk lever, so the LLM does
// not get to invent it.

import type { WeekPhase } from "./phaseModel.ts";
import type { RunSubtype, SlotPlanWeek } from "./sessionSlots.ts";

const MAX_WEEKLY_GROWTH = 1.10; // classic 10%-rule ceiling
const STARTER_BASELINE_KM = 15; // used when athlete reports 0 km/week
const ABSOLUTE_CEILING_MULTIPLE = 2.75; // never let plan peak > 2.75x baseline

// Km share by run subtype at "full budget" — long/easy dominate (aerobic
// volume), quality sessions are km-cheap by design (short intervals, short
// tempo). These are per-subtype pool weights, redistributed across however
// many slots of that subtype exist in the week.
const SUBTYPE_KM_WEIGHTS: Record<RunSubtype, number> = {
  easy: 0.42,
  long: 0.30,
  tempo: 0.13,
  fartlek: 0.09,
  interval: 0.06,
};

export interface RunVolumeWeek {
  weekNumber: number;
  targetKm: number;
  cappedByTenPercentRule: boolean;
  perSlotKm: { subtype: RunSubtype; km: number }[];
}

export interface RunVolumePlan {
  baselineKm: number;
  usedStarterBaseline: boolean;
  peakKm: number;
  weeks: RunVolumeWeek[];
}

export function buildRunVolumePlan(
  currentWeeklyKm: number | null | undefined,
  phaseSchedule: WeekPhase[],
  slotPlan: SlotPlanWeek[]
): RunVolumePlan {
  const usedStarterBaseline = !currentWeeklyKm || currentWeeklyKm <= 0;
  const baseline = usedStarterBaseline ? STARTER_BASELINE_KM : Number(currentWeeklyKm);

  // Peak km: the largest week the 10%-rule would allow before the taper
  // begins. We index growth from week 1 = baseline (unchanged), so peak
  // occurs at whichever pre-taper week has the highest volumeMultiplier.
  const preTaperWeeks = phaseSchedule.filter((w) => w.phase !== "taper");
  const peakGrowthWeeks = preTaperWeeks.length > 0 ? preTaperWeeks.length - 1 : 0;
  const growthCeiling = baseline * Math.pow(MAX_WEEKLY_GROWTH, peakGrowthWeeks);
  const absoluteCeiling = baseline * ABSOLUTE_CEILING_MULTIPLE;
  const peakKm = Math.min(growthCeiling, absoluteCeiling);

  const maxPhaseMultiplier = Math.max(
    ...phaseSchedule.map((w) => w.volumeMultiplier),
    0.0001
  );

  const weeks: RunVolumeWeek[] = phaseSchedule.map((phase, idx) => {
    // Phase-driven target: peak km scaled by this week's multiplier.
    const phaseTarget = peakKm * (phase.volumeMultiplier / maxPhaseMultiplier);
    // 10%-rule ceiling counted from week 1: never exceed baseline * 1.1^(idx).
    const ruleCeiling = baseline * Math.pow(MAX_WEEKLY_GROWTH, idx);
    const capped = phaseTarget > ruleCeiling;
    const targetKm = Math.round(Math.min(phaseTarget, ruleCeiling) * 10) / 10;

    const weekSlots = slotPlan.find((s) => s.weekNumber === phase.weekNumber)?.slots ?? [];
    const runSlots = weekSlots.filter((s) => s.type === "run" && s.subtype) as { subtype: RunSubtype }[];
    const perSlotKm = distributeKmAcrossRunSlots(targetKm, runSlots);

    return {
      weekNumber: phase.weekNumber,
      targetKm,
      cappedByTenPercentRule: capped,
      perSlotKm,
    };
  });

  return { baselineKm: baseline, usedStarterBaseline, peakKm, weeks };
}

function distributeKmAcrossRunSlots(
  weeklyKm: number,
  runSlots: { subtype: RunSubtype }[]
): { subtype: RunSubtype; km: number }[] {
  if (runSlots.length === 0 || weeklyKm <= 0) return [];

  // Group slots by subtype and use SUBTYPE_KM_WEIGHTS restricted to
  // subtypes actually present this week (then renormalize).
  const bySubtype = new Map<RunSubtype, number>();
  for (const slot of runSlots) {
    bySubtype.set(slot.subtype, (bySubtype.get(slot.subtype) ?? 0) + 1);
  }
  const presentWeightTotal = [...bySubtype.keys()].reduce(
    (sum, k) => sum + SUBTYPE_KM_WEIGHTS[k],
    0
  ) || 1;

  const output: { subtype: RunSubtype; km: number }[] = [];
  for (const [subtype, count] of bySubtype) {
    const subtypePool = weeklyKm * (SUBTYPE_KM_WEIGHTS[subtype] / presentWeightTotal);
    const perSlot = Math.round((subtypePool / count) * 10) / 10;
    for (let i = 0; i < count; i++) output.push({ subtype, km: perSlot });
  }
  // Preserve slot ordering (long/tempo first is fine — the LLM assigns days)
  return output;
}

export function formatRunVolumeTable(plan: RunVolumePlan): string {
  const header = plan.usedStarterBaseline
    ? `  (Athlete reported no baseline volume — using conservative ${plan.baselineKm} km/week starter floor.)`
    : `  (Baseline: ${plan.baselineKm} km/week. Peak target: ${plan.peakKm.toFixed(1)} km/week.)`;

  const rows = plan.weeks.map((w) => {
    const breakdown = w.perSlotKm.length > 0
      ? w.perSlotKm.map((s) => `${s.km}km ${s.subtype}`).join(", ")
      : "no run slots";
    const capNote = w.cappedByTenPercentRule ? " [10%-rule capped]" : "";
    return `  Week ${w.weekNumber}: ${w.targetKm} km total${capNote} → ${breakdown}`;
  });

  return [header, ...rows].join("\n");
}
