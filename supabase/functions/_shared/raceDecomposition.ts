// Post-race decomposition: where a HYROX race was won or lost against the
// athlete's own previous and best races in the same division. Deterministic,
// hand-coded; used by the Race Results page and the AI coach.
//
// Kept free of imports so the Deno edge runtime, the Vite frontend and vitest
// all load this exact file.
//
// Rules:
//   * Only races with the same divisionKey are compared — doubles splits are
//     shared work and not comparable to singles.
//   * Relay is never compared: each split is a different athlete's leg.
//   * Only races with all 8 runs, 8 stations and Roxzone take part.
//   * Deltas are this race minus the other one: positive = slower.

export const STATION_NAMES = [
  "SkiErg",
  "Sled Push",
  "Sled Pull",
  "Burpee Broad Jumps",
  "Row",
  "Farmers Carry",
  "Sandbag Lunges",
  "Wall Balls",
] as const;

export type Component = "running" | "stations" | "roxzone";

/** Shape of a race_results row as far as this module is concerned. */
export interface RaceRowLike {
  id: string;
  race_date: string;
  race_name?: string | null;
  category?: string | null;
  division_key?: string | null;
  input_method?: string | null;
  total_time_seconds?: number | null;
  total_transition_seconds?: number | null;
  [key: string]: unknown;
}

export interface RaceSplits {
  id: string;
  date: string;
  name: string | null;
  divisionKey: string;
  total: number;
  runs: number[];
  stations: number[];
  roxzone: number;
}

export interface StationDelta {
  index: number;
  name: string;
  delta: number;
}

export interface RaceComparison {
  against: { id: string; date: string; name: string | null; total: number };
  totalDelta: number;
  runningDelta: number;
  stationsDelta: number;
  roxzoneDelta: number;
  stationDeltas: StationDelta[];
  /** Station where this race gained most (most negative delta), if any gained. */
  biggestGain: StationDelta | null;
  /** Station where this race lost most (most positive delta), if any lost. */
  biggestLoss: StationDelta | null;
  /** Component with the largest absolute contribution to totalDelta. */
  dominant: Component;
}

export interface RaceDecomposition {
  /** False for relay, unknown division or incomplete splits. */
  comparable: boolean;
  running: number | null;
  stations: number | null;
  roxzone: number | null;
  /** Mean of runs 5–8 minus mean of runs 1–4, seconds (positive = faded). */
  runDecaySec: number | null;
  /** Slowest run minus the median run, seconds. */
  worstRunVsMedianSec: number | null;
  previous: RaceComparison | null;
  /** Fastest other race in the division, when this race isn't the PB. */
  best: RaceComparison | null;
  isPersonalBest: boolean;
  /** Number of other comparable races in this division. */
  divisionRaces: number;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Comparison key: the ROXFIT division, else the coarse category for manual rows. */
export function divisionKeyOf(row: RaceRowLike): string | null {
  if (row.division_key) return row.division_key;
  const c = (row.category ?? "").toLowerCase();
  return ["open", "pro", "doubles", "relay"].includes(c) ? c : null;
}

export function isRelayKey(key: string | null): boolean {
  return !!key && key.startsWith("relay");
}

/** Full splits from a race_results row, or null when anything is missing. */
export function toSplits(row: RaceRowLike): RaceSplits | null {
  const key = divisionKeyOf(row);
  if (!key || !row.total_time_seconds) return null;
  const runs: number[] = [];
  const stations: number[] = [];
  for (let i = 1; i <= 8; i++) {
    const r = Number(row[`run_${i}_seconds`]);
    const s = Number(row[`station_${i}_seconds`]);
    if (!(r > 0) || !(s > 0)) return null;
    runs.push(r);
    stations.push(s);
  }
  const roxzone = Number(row.total_transition_seconds);
  if (!(roxzone >= 0) || row.total_transition_seconds == null) return null;
  return {
    id: row.id,
    date: row.race_date,
    name: row.race_name ?? null,
    divisionKey: key,
    total: Number(row.total_time_seconds),
    runs,
    stations,
    roxzone,
  };
}

export function compareRaces(race: RaceSplits, other: RaceSplits): RaceComparison {
  const runningDelta = sum(race.runs) - sum(other.runs);
  const stationsDelta = sum(race.stations) - sum(other.stations);
  const roxzoneDelta = race.roxzone - other.roxzone;
  const stationDeltas = race.stations.map((s, i) => ({
    index: i,
    name: STATION_NAMES[i],
    delta: s - other.stations[i],
  }));
  const byDelta = [...stationDeltas].sort((a, b) => a.delta - b.delta);
  const components: [Component, number][] = [
    ["running", runningDelta],
    ["stations", stationsDelta],
    ["roxzone", roxzoneDelta],
  ];
  const dominant = components.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a))[0];
  return {
    against: { id: other.id, date: other.date, name: other.name, total: other.total },
    totalDelta: race.total - other.total,
    runningDelta,
    stationsDelta,
    roxzoneDelta,
    stationDeltas,
    biggestGain: byDelta[0].delta < 0 ? byDelta[0] : null,
    biggestLoss: byDelta[byDelta.length - 1].delta > 0 ? byDelta[byDelta.length - 1] : null,
    dominant,
  };
}

/** Decomposes one race against the rest of the athlete's race history. */
export function decomposeRace(row: RaceRowLike, history: RaceRowLike[]): RaceDecomposition {
  const race = toSplits(row);
  const empty: RaceDecomposition = {
    comparable: false,
    running: null,
    stations: null,
    roxzone: null,
    runDecaySec: null,
    worstRunVsMedianSec: null,
    previous: null,
    best: null,
    isPersonalBest: false,
    divisionRaces: 0,
  };
  if (!race || isRelayKey(race.divisionKey)) return empty;

  const others = history
    .filter((h) => h.id !== race.id)
    .map(toSplits)
    .filter((s): s is RaceSplits => !!s && s.divisionKey === race.divisionKey);

  const earlier = others.filter((o) => o.date < race.date).sort((a, b) => (a.date < b.date ? 1 : -1));
  const fastest = [...others].sort((a, b) => a.total - b.total)[0] ?? null;
  const isPersonalBest = others.length > 0 && others.every((o) => race.total < o.total);
  const previous = earlier[0] ? compareRaces(race, earlier[0]) : null;
  const best =
    fastest && !isPersonalBest && fastest.id !== earlier[0]?.id ? compareRaces(race, fastest) : null;

  return {
    comparable: true,
    running: sum(race.runs),
    stations: sum(race.stations),
    roxzone: race.roxzone,
    runDecaySec: Math.round(mean(race.runs.slice(4)) - mean(race.runs.slice(0, 4))),
    worstRunVsMedianSec: Math.round(Math.max(...race.runs) - median(race.runs)),
    previous,
    best,
    isPersonalBest,
    divisionRaces: others.length,
  };
}

/** Compact signed "m:ss" for deltas: +1:05, -0:12. */
export function formatDelta(seconds: number): string {
  const sign = seconds > 0 ? "+" : seconds < 0 ? "-" : "±";
  const abs = Math.abs(Math.round(seconds));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/** Plain-text summary for the AI coach prompt (≤ 4 lines). */
export function describeDecomposition(d: RaceDecomposition): string {
  if (!d.comparable) return "";
  const lines: string[] = [];
  const cmp = d.previous ?? d.best;
  if (cmp) {
    const label = d.previous ? "vs previous" : "vs best";
    lines.push(
      `${label} same-division race (${cmp.against.date}): total ${formatDelta(cmp.totalDelta)} = running ${formatDelta(cmp.runningDelta)}, stations ${formatDelta(cmp.stationsDelta)}, Roxzone ${formatDelta(cmp.roxzoneDelta)}; biggest factor: ${cmp.dominant}`,
    );
    const parts: string[] = [];
    if (cmp.biggestGain) parts.push(`best gain ${cmp.biggestGain.name} ${formatDelta(cmp.biggestGain.delta)}`);
    if (cmp.biggestLoss) parts.push(`biggest loss ${cmp.biggestLoss.name} ${formatDelta(cmp.biggestLoss.delta)}`);
    if (parts.length) lines.push(parts.join("; "));
  } else {
    lines.push("first complete race in this division — nothing to compare against yet");
  }
  if (d.runDecaySec !== null) {
    lines.push(
      `run decay (runs 5–8 vs 1–4): ${formatDelta(d.runDecaySec)} per run; slowest run ${formatDelta(d.worstRunVsMedianSec ?? 0)} vs median${d.isPersonalBest ? "; this race is the division PB" : ""}`,
    );
  }
  return lines.join("\n");
}
