// Hand-coded Daniels VDOT-equivalent pace-zone calculation. Deliberately not
// Lovable-prompted: wrong pace math silently misdirects an athlete's entire
// training intensity distribution, the same governance reasoning as
// interferenceRules.ts and the TSB engine.

// Daniels' velocity <-> VO2 relationship (v in m/min):
//   VO2 = -4.60 + 0.182258*v + 0.000104*v^2
// and percent-of-VDOT reached after sustaining effort for t minutes:
//   %max = 0.8 + 0.1894393*e^(-0.012778*t) + 0.2989558*e^(-0.1932605*t)

function vo2FromVelocity(v: number): number {
  return -4.6 + 0.182258 * v + 0.000104 * v * v;
}

function velocityFromVo2(vo2: number): number {
  // Inverse of the quadratic above, positive root.
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

function percentMaxFromTimeMin(t: number): number {
  return 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);
}

// Estimates VDOT from a real or target race performance.
export function estimateVDOT(distanceMeters: number, timeSeconds: number): number {
  const timeMin = timeSeconds / 60;
  const velocity = distanceMeters / timeMin; // m/min
  const vo2 = vo2FromVelocity(velocity);
  const pctMax = percentMaxFromTimeMin(timeMin);
  return vo2 / pctMax;
}

export interface PaceZones {
  easySecPerKm: number;
  marathonSecPerKm: number;
  thresholdSecPerKm: number;
  intervalSecPerKm: number;
  repetitionSecPerKm: number;
}

// Midpoints of Daniels' %VDOT training-intensity bands.
const ZONE_PCT = {
  easy: 0.665, // 59-74%
  marathon: 0.795, // 75-84%
  threshold: 0.855, // 83-88%
  interval: 0.975, // 95-100%
  repetition: 1.125, // 105-120%
};

function secPerKmFromPct(vdot: number, pct: number): number {
  const velocity = velocityFromVo2(vdot * pct); // m/min
  return Math.round((1000 / velocity) * 60);
}

export function paceZonesFromVDOT(vdot: number): PaceZones {
  return {
    easySecPerKm: secPerKmFromPct(vdot, ZONE_PCT.easy),
    marathonSecPerKm: secPerKmFromPct(vdot, ZONE_PCT.marathon),
    thresholdSecPerKm: secPerKmFromPct(vdot, ZONE_PCT.threshold),
    intervalSecPerKm: secPerKmFromPct(vdot, ZONE_PCT.interval),
    repetitionSecPerKm: secPerKmFromPct(vdot, ZONE_PCT.repetition),
  };
}

// Assumed fraction of total HYROX finish time spent running (8x1km), used
// only when the athlete hasn't specified a run-split target directly.
// Calibrated against typical age-group splits (running ~45% of total time;
// elite athletes run a higher fraction, but this is a starting default, not
// a precision claim).
const DEFAULT_HYROX_RUN_TIME_FRACTION = 0.45;

// Decomposes a HYROX total-time goal into an effective 1km run-pace target,
// then derives full pace zones from it. Prefers an explicit run-split
// target over the time-fraction estimate when one is supplied.
export function decomposeHyroxTarget(
  totalSeconds: number,
  runSplitSecPerKm?: number | null
): { runSplitSecPerKm: number; vdot: number; zones: PaceZones } {
  const effectiveRunSplit =
    runSplitSecPerKm && runSplitSecPerKm > 0
      ? runSplitSecPerKm
      : (totalSeconds * DEFAULT_HYROX_RUN_TIME_FRACTION) / 8;

  const vdot = estimateVDOT(1000, effectiveRunSplit);
  return { runSplitSecPerKm: Math.round(effectiveRunSplit), vdot, zones: paceZonesFromVDOT(vdot) };
}

export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}/km`;
}
