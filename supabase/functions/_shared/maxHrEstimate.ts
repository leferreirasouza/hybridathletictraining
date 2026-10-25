// Max-HR estimate from an athlete's own recorded sessions. Hand-coded,
// import-free (the edge runtime, the Vite frontend and vitest load this file).
//
// Used two ways:
//   * as a fallback ceiling for HR plausibility checks when the profile has
//     no max HR (activityQuality.hrFlags), so strap spikes are still caught;
//   * as a suggestion the athlete confirms on the dashboard. Only a confirmed
//     value is written to profiles.max_hr, which is what training-load math
//     (session_trimp) reads — the estimate never changes load numbers on its
//     own.
//
// Method: the 98th percentile of plausible session maxima over the last
// 365 days. One-off strap spikes sit above it; genuinely hard efforts that
// recur define it. Needs enough sessions to be meaningful.

export const MAX_HR_ESTIMATE_PERCENTILE = 0.98;
export const MAX_HR_ESTIMATE_MIN_SESSIONS = 20;
export const MAX_HR_PLAUSIBLE_MIN = 120;
export const MAX_HR_PLAUSIBLE_MAX = 220;
export const MAX_HR_LOOKBACK_DAYS = 365;
/** Suggest raising a profile max only when recorded data clearly exceeds it. */
export const MAX_HR_RAISE_MARGIN_BPM = 3;

export interface MaxHrEstimate {
  bpm: number;
  sampleSize: number;
}

/** Nearest-rank percentile of plausible session maxima, or null when too few. */
export function estimateMaxHr(sessionMaxima: (number | null | undefined)[]): MaxHrEstimate | null {
  const values = sessionMaxima
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v >= MAX_HR_PLAUSIBLE_MIN && v <= MAX_HR_PLAUSIBLE_MAX)
    .sort((a, b) => a - b);
  if (values.length < MAX_HR_ESTIMATE_MIN_SESSIONS) return null;
  const rank = Math.ceil(MAX_HR_ESTIMATE_PERCENTILE * values.length);
  return { bpm: Math.round(values[rank - 1]), sampleSize: values.length };
}

export type MaxHrAdvice =
  | { kind: "none" }
  | { kind: "enter" } // no profile value, not enough data to estimate
  | { kind: "use_estimate"; bpm: number; sampleSize: number } // no profile value, estimate available
  | { kind: "raise"; bpm: number; current: number; sampleSize: number }; // profile value clearly too low

/** What to suggest to the athlete about their max HR. */
export function maxHrAdvice(profileMaxHr: number | null | undefined, estimate: MaxHrEstimate | null): MaxHrAdvice {
  const current = profileMaxHr && profileMaxHr > 0 ? profileMaxHr : null;
  if (!current) return estimate ? { kind: "use_estimate", bpm: estimate.bpm, sampleSize: estimate.sampleSize } : { kind: "enter" };
  if (estimate && estimate.bpm >= current + MAX_HR_RAISE_MARGIN_BPM) {
    return { kind: "raise", bpm: estimate.bpm, current, sampleSize: estimate.sampleSize };
  }
  return { kind: "none" };
}

/** Ceiling to judge HR plausibility with: the confirmed profile value, else the estimate. */
export function effectiveMaxHr(profileMaxHr: number | null | undefined, estimate: MaxHrEstimate | null): number | null {
  if (profileMaxHr && profileMaxHr > 0) return profileMaxHr;
  return estimate?.bpm ?? null;
}
