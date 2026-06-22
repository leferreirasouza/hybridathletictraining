// Hand-coded weekly session-slot allocation. Removes the LLM's discretion
// over *what kind* of session goes where (run-type mix, strength
// frequency, mobility/technique work) — same governance tier as
// interferenceRules.ts/phaseModel.ts. The LLM still writes the actual
// workout content/creativity within these assigned slots.

import type { Phase } from "./phaseModel.ts";

export interface RunTypeWeights {
  easy: number;
  tempo: number;
  interval: number;
  long: number;
  fartlek: number;
}

export type RunSubtype = keyof RunTypeWeights;
export type MobilityTechSubtype = "mobility" | "skill_drill" | "rehab" | "run_mechanics";

export interface Slot {
  type: "run" | "strength" | "mobility_technique";
  subtype?: RunSubtype | MobilityTechSubtype;
  muscleFocus?: string;
}

const MOBILITY_TECH_ROTATION: MobilityTechSubtype[] = ["mobility", "skill_drill", "rehab", "run_mechanics"];

// Phase-adjusted run-type weighting: base favors easy/long volume, peak
// favors race-specific intensity (tempo/interval), mirroring 80/20 practice.
function phaseAdjustedWeights(weights: RunTypeWeights, phase: Phase): RunTypeWeights {
  const w = { ...weights };
  if (phase === "base") {
    w.easy *= 1.3;
    w.long *= 1.15;
    w.interval *= 0.5;
    w.tempo *= 0.7;
  } else if (phase === "peak") {
    w.interval *= 1.4;
    w.tempo *= 1.3;
    w.easy *= 0.8;
  } else if (phase === "taper") {
    w.interval *= 0.5;
    w.long *= 0.4;
    w.easy *= 1.2;
  }
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  for (const k of Object.keys(w) as RunSubtype[]) w[k] = w[k] / total;
  return w;
}

// Largest-remainder allocation of `count` discrete items across weighted buckets.
function allocateByWeight<K extends string>(count: number, weights: Record<K, number>): Record<K, number> {
  const keys = Object.keys(weights) as K[];
  const totalWeight = keys.reduce((sum, k) => sum + weights[k], 0) || 1;
  const raw = keys.map((k) => ({ key: k, exact: (weights[k] / totalWeight) * count }));
  const result = {} as Record<K, number>;
  let allocated = 0;
  for (const r of raw) {
    result[r.key] = Math.floor(r.exact);
    allocated += result[r.key];
  }
  let remainder = count - allocated;
  const byFraction = [...raw].sort((a, b) => (b.exact - Math.floor(b.exact)) - (a.exact - Math.floor(a.exact)));
  for (let i = 0; i < remainder; i++) {
    result[byFraction[i % byFraction.length].key] += 1;
  }
  return result;
}

export interface SlotPlanWeek {
  weekNumber: number;
  slots: Slot[];
}

export function assignWeeklySlots(
  weekNumbers: number[],
  trainingDays: number,
  runTypeWeights: RunTypeWeights,
  strengthSessionsPerWeek: number,
  mobilityTechSessionsPerWeek: number,
  muscleFocus: string[],
  phaseByWeek: Record<number, Phase>
): SlotPlanWeek[] {
  const strengthCount = Math.min(strengthSessionsPerWeek, trainingDays);
  const mobilityTechCount = Math.min(mobilityTechSessionsPerWeek, Math.max(trainingDays - strengthCount, 0));
  const runCount = Math.max(trainingDays - strengthCount - mobilityTechCount, 0);
  const focusRotation = muscleFocus.length > 0 ? muscleFocus : ["full_body"];

  return weekNumbers.map((weekNumber) => {
    const phase = phaseByWeek[weekNumber] || "build";
    const weights = phaseAdjustedWeights(runTypeWeights, phase);
    const runAllocation = allocateByWeight<RunSubtype>(runCount, weights);

    const slots: Slot[] = [];
    for (const subtype of Object.keys(runAllocation) as RunSubtype[]) {
      for (let i = 0; i < runAllocation[subtype]; i++) slots.push({ type: "run", subtype });
    }
    for (let i = 0; i < strengthCount; i++) {
      slots.push({ type: "strength", muscleFocus: focusRotation[i % focusRotation.length] });
    }
    for (let i = 0; i < mobilityTechCount; i++) {
      slots.push({ type: "mobility_technique", subtype: MOBILITY_TECH_ROTATION[i % MOBILITY_TECH_ROTATION.length] });
    }

    return { weekNumber, slots };
  });
}

export function formatSlotTable(plan: SlotPlanWeek[]): string {
  return plan
    .map((w) => {
      const counts = w.slots.reduce((acc, s) => {
        const label = s.type === "run" ? `run(${s.subtype})` : s.type === "strength" ? `strength(${s.muscleFocus})` : `mobility/technique(${s.subtype})`;
        acc[label] = (acc[label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const summary = Object.entries(counts).map(([label, n]) => `${n}x ${label}`).join(", ");
      return `  Week ${w.weekNumber}: ${summary}`;
    })
    .join("\n");
}

// ---- Post-generation compliance check ----
// The planned_sessions schema has no structured run-subtype/mobility-subtype
// column, so subtype matching against real output isn't reliably verifiable.
// This deliberately checks only what CAN be verified: per-week category
// counts (run vs strength vs mobility/technique) against the assigned slot
// counts, to avoid flagging false positives from a check we can't back up.

const STRENGTH_DISCIPLINES = new Set(["strength", "accessories"]);
const MOBILITY_TECH_DISCIPLINES = new Set(["mobility", "prehab"]);
const RUN_DISCIPLINES = new Set(["run"]);

export interface SlotMismatch {
  weekNumber: number;
  category: "run" | "strength" | "mobility_technique";
  expectedCount: number;
  actualCount: number;
  reasonDetails: string;
}

export function validateSlotCompliance(
  insertedSessions: { week_number: number; discipline: string }[],
  slotPlan: SlotPlanWeek[]
): SlotMismatch[] {
  const mismatches: SlotMismatch[] = [];

  for (const week of slotPlan) {
    const weekSessions = insertedSessions.filter((s) => s.week_number === week.weekNumber);
    const expected = {
      run: week.slots.filter((s) => s.type === "run").length,
      strength: week.slots.filter((s) => s.type === "strength").length,
      mobility_technique: week.slots.filter((s) => s.type === "mobility_technique").length,
    };
    const actual = {
      run: weekSessions.filter((s) => RUN_DISCIPLINES.has(s.discipline)).length,
      strength: weekSessions.filter((s) => STRENGTH_DISCIPLINES.has(s.discipline)).length,
      mobility_technique: weekSessions.filter((s) => MOBILITY_TECH_DISCIPLINES.has(s.discipline)).length,
    };

    for (const category of ["run", "strength", "mobility_technique"] as const) {
      if (actual[category] < expected[category]) {
        mismatches.push({
          weekNumber: week.weekNumber,
          category,
          expectedCount: expected[category],
          actualCount: actual[category],
          reasonDetails: `Week ${week.weekNumber}: expected ${expected[category]} ${category} session(s), AI generated ${actual[category]}.`,
        });
      }
    }
  }

  return mismatches;
}
