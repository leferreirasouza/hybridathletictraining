import { describe, it, expect } from 'vitest';
import {
  clockToSeconds,
  normalizeDivision,
  parseRaceName,
  parseRoxfitDescription,
} from '../../supabase/functions/_shared/roxfitParse.ts';
import {
  decomposeRace,
  describeDecomposition,
  formatDelta,
  type RaceRowLike,
} from '../../supabase/functions/_shared/raceDecomposition.ts';
import { ROXFIT_RACES } from './fixtures/roxfitDescriptions';

const errorOf = (p: ReturnType<typeof parseRoxfitDescription>) => ('error' in p ? p.error : '');

const parse = (r: (typeof ROXFIT_RACES)[number]) => parseRoxfitDescription(r.description, r.name, r.elapsed);

/** race_results row as the ingest hook would write it. */
function toRow(r: (typeof ROXFIT_RACES)[number], id: string): RaceRowLike {
  const p = parse(r);
  if (!p.ok) throw new Error(errorOf(p));
  const row: RaceRowLike = {
    id,
    race_date: r.date,
    race_name: `HYROX ${p.race.city}`,
    category: p.race.category,
    division_key: p.race.divisionKey,
    total_time_seconds: p.race.totalSec,
    total_transition_seconds: p.race.roxzoneSec,
  };
  p.race.runs.forEach((s, i) => (row[`run_${i + 1}_seconds`] = s));
  p.race.stations.forEach((s, i) => (row[`station_${i + 1}_seconds`] = s));
  return row;
}

describe('roxfitParse', () => {
  it('parses clock strings', () => {
    expect(clockToSeconds('4:11')).toBe(251);
    expect(clockToSeconds('1:13:43')).toBe(4423);
    expect(clockToSeconds('4:61')).toBeNull();
    expect(clockToSeconds('abc')).toBeNull();
  });

  it('normalizes both spellings of a division to one key', () => {
    expect(normalizeDivision('Doubles Mixed')).toEqual({ key: 'doubles_mixed', category: 'doubles' });
    expect(normalizeDivision('Mixed Doubles')).toEqual({ key: 'doubles_mixed', category: 'doubles' });
    expect(normalizeDivision('Open Men')).toEqual({ key: 'open_men', category: 'open' });
    expect(normalizeDivision('Pro Women')).toEqual({ key: 'pro_women', category: 'pro' });
    expect(normalizeDivision('Mixed Relay')).toEqual({ key: 'relay_mixed', category: 'relay' });
  });

  it('reads the city and official time from the activity name', () => {
    expect(parseRaceName('HYROX - São Paulo - 01:13:44')).toEqual({ city: 'São Paulo', totalSec: 4424 });
    expect(parseRaceName('Morning Run')).toBeNull();
  });

  it('parses all six real races with splits that add up to the official time', () => {
    for (const r of ROXFIT_RACES) {
      const p = parse(r);
      expect(p.ok, `${r.name}: ${errorOf(p)}`).toBe(true);
      if (!p.ok) continue;
      const sum = [...p.race.runs, ...p.race.stations].reduce((a, b) => a + b, 0) + p.race.roxzoneSec;
      expect(Math.abs(sum - p.race.totalSec)).toBeLessThanOrEqual(10);
      expect(p.race.totalSec).toBe(r.elapsed);
    }
  });

  it('maps stations by name in course order', () => {
    const p = parse(ROXFIT_RACES[0]);
    if (!p.ok) throw new Error(errorOf(p));
    expect(p.race.runs).toEqual([307, 300, 358, 312, 321, 306, 322, 293]);
    expect(p.race.stations).toEqual([251, 117, 196, 172, 272, 103, 220, 219]);
    expect(p.race.roxzoneSec).toBe(360);
    expect(p.race.overallRank).toBe(91);
    expect(p.race.ageGroupRank).toBe(29);
    expect(p.race.city).toBe('Sao Paulo');
  });

  it('rejects incomplete splits and splits that do not add up', () => {
    const r = ROXFIT_RACES[0];
    const missing = parseRoxfitDescription(r.description.replace(/Wall Ball: .*\n/, ''), r.name, r.elapsed);
    expect(missing).toEqual({ ok: false, error: 'missing splits: station 8' });
    const wrongTotal = parseRoxfitDescription(r.description, 'HYROX - Sao Paulo - 01:20:00', r.elapsed);
    expect(wrongTotal.ok).toBe(false);
    expect(parseRoxfitDescription(null, r.name, r.elapsed)).toEqual({ ok: false, error: 'no description' });
  });

  it('falls back to elapsed time when the name carries no time', () => {
    const p = parseRoxfitDescription(ROXFIT_RACES[0].description, 'HYROX Sao Paulo', 4423);
    expect(p.ok && p.race.totalSec).toBe(4423);
  });
});

describe('raceDecomposition', () => {
  const rows = ROXFIT_RACES.map((r, i) => toRow(r, `r${i}`));
  const [spApr, ba, dc, spOct, relay, doublesMen] = rows;

  it('compares only within the same division', () => {
    const d = decomposeRace(spOct, rows);
    expect(d.comparable).toBe(true);
    // Doubles Mixed history: SP Apr and Buenos Aires — not DC (Open Men) or Doubles Men.
    expect(d.divisionRaces).toBe(2);
    expect(d.previous?.against.id).toBe(ba.id);
    expect(d.previous?.totalDelta).toBe(4424 - 4369);
  });

  it('decomposes the delta into running, stations and Roxzone', () => {
    const d = decomposeRace(spOct, rows);
    const p = d.previous!;
    expect(p.runningDelta + p.stationsDelta + p.roxzoneDelta).toBe((40 * 60 + 55) - (40 * 60 + 44) + (26 * 60 + 49) - (27 * 60 + 13) + (6 * 60 + 7) - (4 * 60 + 58));
    expect(p.dominant).toBe('roxzone');
    expect(p.biggestLoss?.name).toBe('Wall Balls');
    expect(p.biggestGain?.name).toBe('Burpee Broad Jumps');
  });

  it('flags the division PB and compares the PB only to the previous race', () => {
    const d = decomposeRace(ba, rows);
    expect(d.isPersonalBest).toBe(true);
    expect(d.best).toBeNull();
    expect(d.previous?.against.id).toBe(spApr.id);
  });

  it('never compares relay, and handles a first race in a division', () => {
    expect(decomposeRace(relay, rows).comparable).toBe(false);
    const first = decomposeRace(dc, rows);
    expect(first.comparable).toBe(true);
    expect(first.previous).toBeNull();
    expect(first.divisionRaces).toBe(0);
    expect(describeDecomposition(first)).toContain('first complete race');
  });

  it('measures run decay and the slowest run against the median', () => {
    const d = decomposeRace(doublesMen, rows);
    // runs 5–8 avg (272+384+306+290)/4 = 313; runs 1–4 avg (289+261+273+266)/4 = 272.25
    expect(d.runDecaySec).toBe(41);
    // sorted runs 261 266 272 273 | 289 290 306 384 → median (273 + 289) / 2 = 281
    expect(d.worstRunVsMedianSec).toBe(384 - 281);
  });

  it('skips rows without full splits and formats deltas', () => {
    const goal: RaceRowLike = { id: 'g', race_date: '2026-09-05', category: 'age_35-39', input_method: 'goal', total_time_seconds: null };
    expect(decomposeRace(goal, rows).comparable).toBe(false);
    expect(formatDelta(65)).toBe('+1:05');
    expect(formatDelta(-12)).toBe('-0:12');
    expect(formatDelta(0)).toBe('±0:00');
  });
});
