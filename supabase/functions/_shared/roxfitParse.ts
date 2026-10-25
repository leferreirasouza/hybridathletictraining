// Parser for the official HYROX result that ROXFIT writes into the Strava
// description of its race imports (external_id "roxfit-hyrox-*.fit", name
// "HYROX - <City> - H:MM:SS"). Deterministic, hand-coded: these splits become
// race_results rows that race history, PBs and post-race analysis trust.
//
// Kept free of imports so the Deno edge runtime and vitest load the same file.
//
// Expected shape (one line each, emoji prefixes optional):
//   🏆 Division: Doubles Mixed
//   📊 Overall Rank: 91
//   🎯 Age Group Rank: 29
//   Run 1: 5:07
//   Ski Erg: 4:11
//   … (Run 2–8 interleaved with the other 7 stations)
//   Roxzone: 6:00

/** Splits may differ from the official total by rounding; beyond this, reject. */
export const SPLIT_SUM_TOLERANCE_SECONDS = 10;

/** Station order on the course — matches race_results.station_1..8. */
const STATION_PATTERNS: RegExp[] = [
  /^ski\s*erg$/i,
  /^sled\s*push$/i,
  /^sled\s*pull$/i,
  /^burpee\s*broad\s*jumps?$/i,
  /^row(ing)?(\s*erg)?$/i,
  /^farmers?\s*carry$/i,
  /^sandbag\s*lunges?$/i,
  /^wall\s*balls?$/i,
];

const SPLIT_LINE = /^(?:[^\p{L}\d]*)([\p{L}][\p{L}\s']*?\d?)\s*:\s*(\d{1,2}(?::\d{2}){1,2})\s*$/u;
const RACE_NAME = /^HYROX - (.+) - (\d{1,2}:\d{2}:\d{2})$/;

export type RaceFormat = "open" | "pro" | "doubles" | "relay";

export interface RoxfitRace {
  division: string;
  /** e.g. "doubles_mixed", "open_men"; races compare only within one key. */
  divisionKey: string;
  /** Coarse format for the existing race_results.category badge. */
  category: RaceFormat;
  overallRank: number | null;
  ageGroupRank: number | null;
  runs: number[];
  stations: number[];
  roxzoneSec: number;
  totalSec: number;
  city: string | null;
}

export type RoxfitParseResult = { ok: true; race: RoxfitRace } | { ok: false; error: string };

/** "4:11" → 251, "1:13:43" → 4423. */
export function clockToSeconds(text: string): number | null {
  const parts = text.trim().split(":").map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !Number.isInteger(p) || p < 0)) return null;
  if (parts.slice(1).some((p) => p >= 60)) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/**
 * Division text → comparison key. Word order varies ("Mixed Doubles" and
 * "Doubles Mixed" both occur), so this reads tokens, not the whole string.
 */
export function normalizeDivision(division: string): { key: string; category: RaceFormat } {
  const d = division.toLowerCase();
  const category: RaceFormat = /relay/.test(d)
    ? "relay"
    : /doubles?/.test(d)
      ? "doubles"
      : /\bpro\b/.test(d)
        ? "pro"
        : "open";
  const gender = /mixed/.test(d)
    ? "mixed"
    : /\b(women|woman|female|ladies)\b/.test(d)
      ? "women"
      : /\b(men|man|male)\b/.test(d)
        ? "men"
        : null;
  return { key: gender ? `${category}_${gender}` : category, category };
}

/** City from a ROXFIT activity name, e.g. "HYROX - São Paulo - 01:13:44". */
export function parseRaceName(name: string | null | undefined): { city: string; totalSec: number } | null {
  const m = RACE_NAME.exec((name ?? "").trim());
  if (!m) return null;
  const totalSec = clockToSeconds(m[2]);
  return totalSec === null ? null : { city: m[1].trim(), totalSec };
}

/**
 * officialSeconds: the activity's elapsed_time, used when the name carries
 * no finish time. The time in the name wins when present — it is the
 * published result.
 */
export function parseRoxfitDescription(
  description: string | null | undefined,
  activityName: string | null | undefined,
  officialSeconds: number | null | undefined,
): RoxfitParseResult {
  if (!description) return { ok: false, error: "no description" };

  const division = /Division:\s*(.+?)\s*$/im.exec(description)?.[1] ?? null;
  if (!division) return { ok: false, error: "no division line" };
  const overall = /Overall Rank:\s*(\d+)/i.exec(description)?.[1];
  const ageGroup = /Age Group Rank:\s*(\d+)/i.exec(description)?.[1];

  const runs: (number | null)[] = Array(8).fill(null);
  const stations: (number | null)[] = Array(8).fill(null);
  let roxzone: number | null = null;

  for (const rawLine of description.split(/\r?\n/)) {
    const m = SPLIT_LINE.exec(rawLine.trim());
    if (!m) continue;
    const label = m[1].trim();
    const seconds = clockToSeconds(m[2]);
    if (seconds === null) continue;

    const run = /^run\s*([1-8])$/i.exec(label);
    if (run) {
      runs[Number(run[1]) - 1] = seconds;
      continue;
    }
    if (/^roxzone$/i.test(label)) {
      roxzone = seconds;
      continue;
    }
    const idx = STATION_PATTERNS.findIndex((p) => p.test(label));
    if (idx >= 0) stations[idx] = seconds;
  }

  const missing = [
    ...runs.flatMap((v, i) => (v === null ? [`Run ${i + 1}`] : [])),
    ...stations.flatMap((v, i) => (v === null ? [`station ${i + 1}`] : [])),
    ...(roxzone === null ? ["Roxzone"] : []),
  ];
  if (missing.length > 0) return { ok: false, error: `missing splits: ${missing.join(", ")}` };

  const fromName = parseRaceName(activityName);
  const totalSec = fromName?.totalSec ?? (officialSeconds && officialSeconds > 0 ? Math.round(officialSeconds) : null);
  if (!totalSec) return { ok: false, error: "no official total time" };

  const sum = [...runs, ...stations].reduce<number>((a, b) => a + (b ?? 0), 0) + (roxzone ?? 0);
  if (Math.abs(sum - totalSec) > SPLIT_SUM_TOLERANCE_SECONDS) {
    return { ok: false, error: `splits sum to ${sum}s but the official total is ${totalSec}s` };
  }

  const { key, category } = normalizeDivision(division);
  return {
    ok: true,
    race: {
      division,
      divisionKey: key,
      category,
      overallRank: overall ? Number(overall) : null,
      ageGroupRank: ageGroup ? Number(ageGroup) : null,
      runs: runs as number[],
      stations: stations as number[],
      roxzoneSec: roxzone as number,
      totalSec,
      city: fromName?.city ?? null,
    },
  };
}
