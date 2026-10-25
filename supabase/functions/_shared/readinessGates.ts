// Readiness gates from daily sleep / HRV / resting-HR data (Garmin today).
// Deterministic, hand-coded, import-free (vitest loads the same file).
//
// A gate never changes a plan: compute-training-load turns a fired gate into
// a pending `readiness_downgrade` suggestion the athlete or coach approves.
// The thresholds below are the defaults from the owner's personal training
// system (2026-10), not validated clinical cut-offs — tune them here only.

export const SHORT_SLEEP_HOURS = 6.5;
export const SHORT_SLEEP_NIGHTS = 2;
export const HRV_BASELINE_DAYS = 60;
export const HRV_RECENT_DAYS = 7;
export const HRV_MIN_BASELINE_NIGHTS = 14;
export const HRV_MIN_RECENT_NIGHTS = 3;
/** HRV nights only count when sleep was long enough, so short sleep isn't counted twice. */
export const HRV_MIN_SLEEP_HOURS = 7;
export const RHR_RECENT_DAYS = 3;
export const RHR_PRIOR_DAYS = 7;
export const RHR_ELEVATION_BPM = 5;
/** A single HRV / RHR value this far off its trailing 7-day mean is a sensor artefact. */
export const OUTLIER_FRACTION = 0.4;
/** Without data from the last few days there is nothing current to judge. */
export const FRESH_DAYS = 3;

export interface DailyReadiness {
  date: string; // YYYY-MM-DD
  sleepHours: number | null;
  hrvMs: number | null;
  restingHr: number | null;
}

export type GateCode = "short_sleep" | "hrv_low" | "rhr_elevated";

export interface Gate {
  code: GateCode;
  detail: string;
}

export interface ReadinessResult {
  status: "ok" | "insufficient_data";
  gates: Gate[];
  /** Latest day with any data, when there is some. */
  latestDate: string | null;
}

const dayIndex = (iso: string) => Math.floor(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86400000);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Drops single values more than OUTLIER_FRACTION off the trailing 7-day mean. */
function withoutOutliers(rows: DailyReadiness[], key: "hrvMs" | "restingHr"): Map<string, number> {
  const kept = new Map<string, number>();
  const history: { day: number; v: number }[] = [];
  for (const row of rows) {
    const v = row[key];
    if (v == null || !(v > 0)) continue;
    const day = dayIndex(row.date);
    const window = history.filter((h) => h.day >= day - 7 && h.day < day).map((h) => h.v);
    const isOutlier = window.length >= 3 && Math.abs(v - mean(window)) / mean(window) > OUTLIER_FRACTION;
    if (!isOutlier) {
      kept.set(row.date, v);
      history.push({ day, v });
    }
  }
  return kept;
}

export function evaluateReadiness(input: DailyReadiness[], today: string): ReadinessResult {
  const todayIdx = dayIndex(today);
  const rows = [...input]
    .filter((r) => r.date && dayIndex(r.date) <= todayIdx && dayIndex(r.date) > todayIdx - HRV_BASELINE_DAYS)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const hasData = (r: DailyReadiness) => r.sleepHours != null || r.hrvMs != null || r.restingHr != null;
  const withData = rows.filter(hasData);
  const latestDate = withData.length ? withData[withData.length - 1].date : null;
  if (!latestDate || dayIndex(latestDate) < todayIdx - FRESH_DAYS) {
    return { status: "insufficient_data", gates: [], latestDate };
  }
  const latestIdx = dayIndex(latestDate);
  const gates: Gate[] = [];

  // Short sleep: the most recent nights, consecutive, each below the floor.
  const sleeps = rows.filter((r) => r.sleepHours != null);
  const lastNights = sleeps.slice(-SHORT_SLEEP_NIGHTS);
  const consecutive =
    lastNights.length === SHORT_SLEEP_NIGHTS &&
    dayIndex(lastNights[lastNights.length - 1].date) >= latestIdx - 1 &&
    lastNights.every((n, i) => i === 0 || dayIndex(n.date) - dayIndex(lastNights[i - 1].date) === 1);
  if (consecutive && lastNights.every((n) => (n.sleepHours as number) < SHORT_SLEEP_HOURS)) {
    gates.push({
      code: "short_sleep",
      detail: `Slept ${lastNights.map((n) => `${r1(n.sleepHours as number)} h`).join(" and ")} the last ${SHORT_SLEEP_NIGHTS} nights (below ${SHORT_SLEEP_HOURS} h).`,
    });
  }

  // HRV below the personal floor (baseline mean − 1 SD), on adequately slept nights.
  const hrv = withoutOutliers(rows, "hrvMs");
  const eligible = rows
    .filter((r) => hrv.has(r.date) && (r.sleepHours == null || r.sleepHours >= HRV_MIN_SLEEP_HOURS))
    .map((r) => ({ day: dayIndex(r.date), v: hrv.get(r.date) as number }));
  const recentHrv = eligible.filter((e) => e.day > latestIdx - HRV_RECENT_DAYS).map((e) => e.v);
  const baselineHrv = eligible.filter((e) => e.day <= latestIdx - HRV_RECENT_DAYS).map((e) => e.v);
  if (baselineHrv.length >= HRV_MIN_BASELINE_NIGHTS && recentHrv.length >= HRV_MIN_RECENT_NIGHTS) {
    const floor = mean(baselineHrv) - sd(baselineHrv);
    const recent = mean(recentHrv);
    if (recent < floor) {
      gates.push({
        code: "hrv_low",
        detail: `7-day HRV ${Math.round(recent)} ms is below the personal floor of ${Math.round(floor)} ms (baseline ${Math.round(mean(baselineHrv))} ms − 1 SD).`,
      });
    }
  }

  // Resting HR: last 3 days vs the 7 days before them.
  const rhr = withoutOutliers(rows, "restingHr");
  const rhrDays = rows.filter((r) => rhr.has(r.date)).map((r) => ({ day: dayIndex(r.date), v: rhr.get(r.date) as number }));
  const recentRhr = rhrDays.filter((d) => d.day > latestIdx - RHR_RECENT_DAYS).map((d) => d.v);
  const priorRhr = rhrDays
    .filter((d) => d.day <= latestIdx - RHR_RECENT_DAYS && d.day > latestIdx - RHR_RECENT_DAYS - RHR_PRIOR_DAYS)
    .map((d) => d.v);
  if (recentRhr.length >= 2 && priorRhr.length >= 5) {
    const recent = mean(recentRhr);
    const prior = mean(priorRhr);
    if (recent >= prior + RHR_ELEVATION_BPM) {
      gates.push({
        code: "rhr_elevated",
        detail: `Resting HR averaged ${Math.round(recent)} bpm over the last ${RHR_RECENT_DAYS} days vs ${Math.round(prior)} bpm the week before (+${Math.round(recent - prior)}).`,
      });
    }
  }

  return { status: "ok", gates, latestDate };
}

/** Merges Garmin daily summaries and sleep rows into one series by date. */
export function mergeGarminDays(
  dailies: { calendar_date: string; resting_hr: number | null; hrv_ms: number | null }[],
  sleeps: { calendar_date: string; duration_sec: number | null; avg_hrv_ms: number | null }[],
): DailyReadiness[] {
  const byDate = new Map<string, DailyReadiness>();
  const get = (date: string) => {
    const key = date.slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, { date: key, sleepHours: null, hrvMs: null, restingHr: null });
    return byDate.get(key) as DailyReadiness;
  };
  for (const d of dailies) {
    const row = get(d.calendar_date);
    if (d.resting_hr != null) row.restingHr = Number(d.resting_hr);
    if (d.hrv_ms != null && row.hrvMs == null) row.hrvMs = Number(d.hrv_ms);
  }
  for (const s of sleeps) {
    const row = get(s.calendar_date);
    if (s.duration_sec != null) row.sleepHours = Number(s.duration_sec) / 3600;
    // Overnight HRV from the sleep record is preferred over the daily summary's.
    if (s.avg_hrv_ms != null) row.hrvMs = Number(s.avg_hrv_ms);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
