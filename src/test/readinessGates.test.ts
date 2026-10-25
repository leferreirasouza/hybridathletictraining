import { describe, it, expect } from 'vitest';
import {
  evaluateReadiness,
  mergeGarminDays,
  type DailyReadiness,
} from '../../supabase/functions/_shared/readinessGates.ts';

const TODAY = '2026-10-25';
const dayBefore = (n: number) => new Date(Date.parse(`${TODAY}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

/** 40 normal days ending today: ~7.5 h sleep, HRV ~60 ms, RHR ~50 bpm, small deterministic wobble. */
function normalSeries(days = 40): DailyReadiness[] {
  return Array.from({ length: days }, (_, i) => {
    const n = days - 1 - i; // days before today
    const wobble = [0, 2, -2, 1, -1, 3, -3][n % 7];
    return { date: dayBefore(n), sleepHours: 7.5 + wobble / 10, hrvMs: 60 + wobble, restingHr: 50 + Math.sign(wobble) };
  });
}

const withLast = (rows: DailyReadiness[], lastN: number, patch: Partial<DailyReadiness>) =>
  rows.map((r, i) => (i >= rows.length - lastN ? { ...r, ...patch } : r));

const codes = (rows: DailyReadiness[]) => evaluateReadiness(rows, TODAY).gates.map((g) => g.code);

describe('readinessGates', () => {
  it('raises nothing on a normal series', () => {
    const r = evaluateReadiness(normalSeries(), TODAY);
    expect(r.status).toBe('ok');
    expect(r.gates).toEqual([]);
  });

  it('flags two consecutive short nights, not one', () => {
    expect(codes(withLast(normalSeries(), 2, { sleepHours: 5.9 }))).toEqual(['short_sleep']);
    expect(codes(withLast(normalSeries(), 1, { sleepHours: 5.9 }))).toEqual([]);
  });

  it('flags HRV below the personal floor on well-slept nights', () => {
    const rows = withLast(normalSeries(), 5, { hrvMs: 52 });
    const r = evaluateReadiness(rows, TODAY);
    expect(r.gates.map((g) => g.code)).toEqual(['hrv_low']);
    expect(r.gates[0].detail).toMatch(/7-day HRV \d+ ms is below the personal floor/);
  });

  it('ignores low-HRV nights that were also short (counted by short_sleep instead)', () => {
    const rows = withLast(normalSeries(), 5, { hrvMs: 52, sleepHours: 6.8 });
    expect(codes(rows)).toEqual([]);
  });

  it('needs enough HRV history before judging it', () => {
    expect(codes(withLast(normalSeries(15), 5, { hrvMs: 52 }))).toEqual([]);
  });

  it('flags resting HR 5+ bpm above the previous week', () => {
    expect(codes(withLast(normalSeries(), 3, { restingHr: 56 }))).toEqual(['rhr_elevated']);
    expect(codes(withLast(normalSeries(), 3, { restingHr: 53 }))).toEqual([]);
  });

  it('drops single-night sensor artefacts', () => {
    // One absurd HRV night (> 40 % off its 7-day mean) is dropped, not averaged in.
    const rows = withLast(normalSeries(), 1, { hrvMs: 20 });
    expect(codes(rows)).toEqual([]);
  });

  it('reports insufficient data when nothing is recent', () => {
    const stale = normalSeries().map((r) => ({ ...r, date: dayBefore(10 + Number(TODAY.slice(8)) - Number(r.date.slice(8))) }))
      .filter((r) => r.date <= dayBefore(5));
    expect(evaluateReadiness(stale, TODAY).status).toBe('insufficient_data');
    expect(evaluateReadiness([], TODAY)).toEqual({ status: 'insufficient_data', gates: [], latestDate: null });
  });

  it('merges Garmin dailies and sleep, preferring overnight HRV', () => {
    const merged = mergeGarminDays(
      [{ calendar_date: '2026-10-24', resting_hr: 51, hrv_ms: 70 }],
      [{ calendar_date: '2026-10-24', duration_sec: 27000, avg_hrv_ms: 62 }, { calendar_date: '2026-10-25', duration_sec: 21600, avg_hrv_ms: null }],
    );
    expect(merged).toEqual([
      { date: '2026-10-24', sleepHours: 7.5, hrvMs: 62, restingHr: 51 },
      { date: '2026-10-25', sleepHours: 6, hrvMs: null, restingHr: null },
    ]);
  });
});
