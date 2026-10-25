// Activity data-quality rules for imported workouts. Deterministic,
// hand-coded: the verdicts here decide what the training-load engine, the
// recent-training baseline and the AI coach treat as measured fact.
//
// Kept free of imports so the Deno edge runtime and vitest (via relative
// import from src/test/) load the exact same file.
//
// The one-off SQL backfill in scripts/backfill-activity-quality-2026-10-25.sql
// mirrors these rules for already-stored rows — if a rule changes here, it
// does not retroactively change stored flags.

export type DataFlag =
  | "race"
  | "distance_estimated"
  | "hr_artifact"
  | "max_hr_artifact"
  | "manual_entry";

export const HR_FLAGS: readonly DataFlag[] = ["hr_artifact", "max_hr_artifact"];

/** The subset of a Strava activity payload these rules read. */
export interface QualityInput {
  type?: string;
  sport_type?: string;
  name?: string;
  external_id?: string | null;
  workout_type?: number | null;
  trainer?: boolean;
  manual?: boolean;
  moving_time?: number;
  elapsed_time?: number;
  distance?: number;
  average_heartrate?: number;
  max_heartrate?: number;
}

/** A HYROX race / full simulation recorded as a Run is not running volume. */
export const HYROX_EFFORT_MIN_SECONDS = 40 * 60;

/** Max HR this far above the athlete's known max is a strap spike. */
export const MAX_HR_TOLERANCE_BPM = 10;
/** Ceilings used when the athlete has no max HR on their profile. */
export const DEFAULT_MAX_HR_CEILING = 220;
export const DEFAULT_AVG_HR_CEILING = 200;
export const MIN_PLAUSIBLE_AVG_HR = 40;

/** Two recordings overlapping this share of the shorter one are one effort. */
export const DUPLICATE_OVERLAP_FRACTION = 0.5;
export const DUPLICATE_MIN_SECONDS = 5 * 60;

const RUN_SPORTS = new Set(["Run", "TrailRun", "VirtualRun"]);
const VIRTUAL_SPORTS = new Set(["VirtualRun", "VirtualRide"]);
/** Strava workout_type: 1 = run race, 11 = ride race. */
const RACE_WORKOUT_TYPES = new Set([1, 11]);

const ROXFIT_RACE_EXTERNAL_ID = /^roxfit-hyrox-/i;
const HYROX_RACE_NAME = /^HYROX - .+ - \d{1,2}:\d{2}:\d{2}$/;
const HYROX_NAME = /hyrox|simulad/i;

function sportOf(a: QualityInput): string {
  return (a.sport_type || a.type || "").trim();
}

/**
 * An official HYROX race result imported by ROXFIT. These carry the
 * official finish time as elapsed_time (moving_time drops station work) and
 * distance is the nominal 8 km course, not a measurement.
 */
export function isHyroxRaceImport(a: QualityInput): boolean {
  return ROXFIT_RACE_EXTERNAL_ID.test(a.external_id ?? "") || HYROX_RACE_NAME.test(a.name ?? "");
}

/**
 * A HYROX race or full simulation, whatever sport type it was saved as.
 * These count as hyrox_station work: their running is real, but race pace on
 * an estimated distance isn't comparable to training runs, and counting it
 * as run km inflates the volume baseline the plan generator ramps from.
 */
export function isHyroxEffort(a: QualityInput): boolean {
  if (isHyroxRaceImport(a)) return true;
  if (!RUN_SPORTS.has(sportOf(a))) return false;
  const duration = Math.max(a.elapsed_time ?? 0, a.moving_time ?? 0);
  return HYROX_NAME.test(a.name ?? "") && duration >= HYROX_EFFORT_MIN_SECONDS;
}

export function isRace(a: QualityInput): boolean {
  return isHyroxRaceImport(a) || (a.workout_type != null && RACE_WORKOUT_TYPES.has(Number(a.workout_type)));
}

/** Seconds to record as the session's duration. */
export function effectiveDurationSec(a: QualityInput): number | null {
  if (isHyroxRaceImport(a)) return a.elapsed_time ?? a.moving_time ?? null;
  return a.moving_time ?? a.elapsed_time ?? null;
}

/** The span the recording occupies on the clock, for overlap checks. */
export function recordedSpanSec(a: QualityInput): number {
  return Math.max(a.elapsed_time ?? 0, a.moving_time ?? 0);
}

/** HR plausibility against the athlete's own max HR when known. */
export function hrFlags(
  avgHr: number | null | undefined,
  maxHr: number | null | undefined,
  athleteMaxHr: number | null | undefined,
): DataFlag[] {
  const flags: DataFlag[] = [];
  const known = athleteMaxHr && athleteMaxHr > 0 ? athleteMaxHr : null;
  const maxCeiling = known ? known + MAX_HR_TOLERANCE_BPM : DEFAULT_MAX_HR_CEILING;
  const avgCeiling = known ?? DEFAULT_AVG_HR_CEILING;

  if (maxHr && maxHr > maxCeiling) flags.push("max_hr_artifact");
  if (avgHr) {
    const implausible =
      avgHr > avgCeiling || avgHr < MIN_PLAUSIBLE_AVG_HR || (maxHr != null && maxHr > 0 && avgHr > maxHr);
    if (implausible) flags.push("hr_artifact");
  }
  return flags;
}

export function activityFlags(a: QualityInput, athleteMaxHr: number | null | undefined): DataFlag[] {
  const flags: DataFlag[] = [];
  if (isRace(a)) flags.push("race");
  const hasDistance = (a.distance ?? 0) > 0;
  if (hasDistance && (a.trainer === true || VIRTUAL_SPORTS.has(sportOf(a)) || isHyroxRaceImport(a))) {
    flags.push("distance_estimated");
  }
  if (a.manual === true) flags.push("manual_entry");
  const avg = a.average_heartrate ? Math.round(a.average_heartrate) : null;
  const max = a.max_heartrate ? Math.round(a.max_heartrate) : null;
  flags.push(...hrFlags(avg, max, athleteMaxHr));
  return flags;
}

export function unionFlags(...lists: (readonly string[] | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const list of lists) for (const f of list ?? []) out.add(f);
  return [...out].sort();
}

/** Share of the shorter recording covered by the overlap, 0..1. */
export function overlapFraction(
  aStartMs: number,
  aSpanSec: number,
  bStartMs: number,
  bSpanSec: number,
): number {
  const shorter = Math.min(aSpanSec, bSpanSec);
  if (!(shorter > 0)) return 0;
  const overlapMs = Math.min(aStartMs + aSpanSec * 1000, bStartMs + bSpanSec * 1000) - Math.max(aStartMs, bStartMs);
  return Math.max(0, overlapMs / 1000) / shorter;
}

/** Whether two recordings are the same physical effort captured twice. */
export function isSameEffort(
  aStartMs: number,
  aSpanSec: number,
  bStartMs: number,
  bSpanSec: number,
): boolean {
  if (aSpanSec < DUPLICATE_MIN_SECONDS || bSpanSec < DUPLICATE_MIN_SECONDS) return false;
  return overlapFraction(aStartMs, aSpanSec, bStartMs, bSpanSec) >= DUPLICATE_OVERLAP_FRACTION;
}

/** Flags that make a session's pace unusable as a training-pace signal. */
export function paceUntrusted(flags: readonly string[] | null | undefined): boolean {
  return (flags ?? []).some((f) => f === "distance_estimated" || f === "race");
}
