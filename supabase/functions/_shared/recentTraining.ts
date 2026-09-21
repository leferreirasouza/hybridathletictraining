// Recent-training summary derived from logged completions (manual, Garmin or
// Strava). Deterministic, hand-coded: it is the factual baseline the plan
// generator trusts over anything self-reported in the wizard.
//
// The client mirror of this math lives in src/lib/recentTraining.ts — keep the
// two aligned if either changes.

export const RECENT_TRAINING_WEEKS = 8;
export const LAYOFF_DAYS_THRESHOLD = 14;

export interface CompletionRowLike {
  date: string;
  discipline: string | null;
  actual_duration_min: number | null;
  actual_distance_km: number | null;
  avg_hr: number | null;
  avg_pace: string | null;
}

export interface RecentTrainingWeek {
  weekIndex: number; // 1 = oldest of the window
  runKm: number;
  hours: number;
  sessions: number;
}

export interface RecentTraining {
  windowWeeks: number;
  weeks: RecentTrainingWeek[];
  weeklyRunKm: number[]; // oldest → newest
  avgRunKm8w: number;
  avgRunKm4w: number;
  longestRunKm: number;
  weeklyHoursByDiscipline: Record<string, number>;
  avgRunPaceSecPerKm: number | null;
  avgRunHr: number | null;
  daysSinceLastRun: number | null;
  totalSessions: number;
  hasData: boolean;
}

function parsePaceToSeconds(pace: string | null): number | null {
  if (!pace) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(pace.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function dayDiff(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

export function computeRecentTraining(
  rows: CompletionRowLike[],
  today: Date = new Date(),
  windowWeeks: number = RECENT_TRAINING_WEEKS,
): RecentTraining {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const windowDays = windowWeeks * 7;
  const start = new Date(end.getTime() - (windowDays - 1) * 86400000);

  const weeks: RecentTrainingWeek[] = Array.from({ length: windowWeeks }, (_, i) => ({
    weekIndex: i + 1,
    runKm: 0,
    hours: 0,
    sessions: 0,
  }));

  const hoursByDiscipline: Record<string, number> = {};
  let longestRunKm = 0;
  let paceSum = 0;
  let paceCount = 0;
  let hrSum = 0;
  let hrCount = 0;
  let lastRunDate: Date | null = null;
  let totalSessions = 0;

  for (const row of rows) {
    if (!row?.date) continue;
    const d = new Date(`${row.date}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;

    const isRun = row.discipline === "run";
    if (isRun && (!lastRunDate || d > lastRunDate)) lastRunDate = d;

    if (d < start || d > end) continue;
    const idx = Math.min(windowWeeks - 1, Math.floor(dayDiff(start, d) / 7));

    const minutes = Number(row.actual_duration_min ?? 0) || 0;
    const km = Number(row.actual_distance_km ?? 0) || 0;

    totalSessions++;
    weeks[idx].sessions++;
    weeks[idx].hours += minutes / 60;
    const disc = row.discipline ?? "custom";
    hoursByDiscipline[disc] = (hoursByDiscipline[disc] ?? 0) + minutes / 60;

    if (isRun) {
      weeks[idx].runKm += km;
      if (km > longestRunKm) longestRunKm = km;
      const paceSec = parsePaceToSeconds(row.avg_pace);
      if (paceSec) {
        paceSum += paceSec;
        paceCount++;
      }
      if (row.avg_hr) {
        hrSum += Number(row.avg_hr);
        hrCount++;
      }
    }
  }

  const round1 = (n: number) => Math.round(n * 10) / 10;
  for (const w of weeks) {
    w.runKm = round1(w.runKm);
    w.hours = round1(w.hours);
  }
  const weeklyRunKm = weeks.map((w) => w.runKm);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

  const weeklyHoursByDiscipline: Record<string, number> = {};
  for (const [k, v] of Object.entries(hoursByDiscipline)) {
    weeklyHoursByDiscipline[k] = round1(v / windowWeeks);
  }

  return {
    windowWeeks,
    weeks,
    weeklyRunKm,
    avgRunKm8w: round1(avg(weeklyRunKm)),
    avgRunKm4w: round1(avg(weeklyRunKm.slice(-4))),
    longestRunKm: round1(longestRunKm),
    weeklyHoursByDiscipline,
    avgRunPaceSecPerKm: paceCount > 0 ? Math.round(paceSum / paceCount) : null,
    avgRunHr: hrCount > 0 ? Math.round(hrSum / hrCount) : null,
    daysSinceLastRun: lastRunDate ? dayDiff(lastRunDate, end) : null,
    totalSessions,
    hasData: totalSessions > 0,
  };
}

/** Loads the window from completed_sessions and summarises it. */
export async function fetchRecentTraining(
  // deno-lint-ignore no-explicit-any
  client: any,
  athleteId: string,
  windowWeeks: number = RECENT_TRAINING_WEEKS,
): Promise<RecentTraining> {
  const today = new Date();
  const since = new Date(today.getTime() - (windowWeeks * 7 + 120) * 86400000)
    .toISOString()
    .slice(0, 10);
  const { data } = await client
    .from("completed_sessions")
    .select("date, discipline, actual_duration_min, actual_distance_km, avg_hr, avg_pace")
    .eq("athlete_id", athleteId)
    .gte("date", since)
    .order("date", { ascending: true });
  return computeRecentTraining((data ?? []) as CompletionRowLike[], today, windowWeeks);
}

export function isReturnFromLayoff(rt: RecentTraining | null | undefined): boolean {
  if (!rt) return false;
  return rt.daysSinceLastRun === null || rt.daysSinceLastRun >= LAYOFF_DAYS_THRESHOLD;
}

export function formatRecentTrainingTable(rt: RecentTraining): string {
  if (!rt.hasData) {
    return "  (No logged sessions in the trailing window — nothing to verify the athlete's self-reported volume against.)";
  }
  const lines: string[] = [];
  lines.push(
    `  Trailing ${rt.windowWeeks}-week weekly run km (oldest → newest): ${rt.weeklyRunKm.join(", ")}`,
  );
  lines.push(
    `  Average run km/week: ${rt.avgRunKm8w} (last 4 weeks: ${rt.avgRunKm4w}) | Longest single run: ${rt.longestRunKm} km`,
  );
  const disc = Object.entries(rt.weeklyHoursByDiscipline)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}h/wk`)
    .join(", ");
  if (disc) lines.push(`  Weekly hours by discipline: ${disc}`);
  if (rt.avgRunPaceSecPerKm) {
    const m = Math.floor(rt.avgRunPaceSecPerKm / 60);
    const s = rt.avgRunPaceSecPerKm % 60;
    lines.push(`  Average logged run pace: ${m}:${String(s).padStart(2, "0")}/km`);
  }
  if (rt.avgRunHr) lines.push(`  Average run heart rate: ${rt.avgRunHr} bpm`);
  lines.push(
    `  Days since last logged run: ${rt.daysSinceLastRun ?? "no run on record"}`,
  );
  return lines.join("\n");
}
