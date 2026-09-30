// recentTraining.ts is deliberately hand-duplicated between src/lib/ (client)
// and supabase/functions/_shared/ (Deno edge runtime) — they can't share a
// build pipeline (Vite vs Lovable's per-file edge-function deploy), so a
// relative import isn't a deployable option. This test instead guards against
// the two copies silently drifting: it feeds identical fixtures through both
// and asserts identical output. Same failure class as the session_trimp()
// bug (CLAUDE.md, 2026-09-21) — a quiet mismatch here would misinform
// generate-plan's run-volume math relative to what the wizard shows athletes.
import { describe, it, expect } from 'vitest';
import { computeRecentTraining as clientCompute, isReturnFromLayoff as clientIsLayoff } from '@/lib/recentTraining';
import {
  computeRecentTraining as edgeCompute,
  isReturnFromLayoff as edgeIsLayoff,
  // @ts-expect-error -- Deno edge-function source, not part of the app's tsconfig "include"
} from '../../supabase/functions/_shared/recentTraining.ts';

const today = new Date('2026-09-30T00:00:00Z');

const fixtures = [
  { name: 'empty history', rows: [] },
  {
    name: 'mixed disciplines, one layoff gap',
    rows: [
      { date: '2026-08-01', discipline: 'run', actual_duration_min: 40, actual_distance_km: 8, avg_hr: 150, avg_pace: '5:00' },
      { date: '2026-08-08', discipline: 'run', actual_duration_min: 50, actual_distance_km: 10, avg_hr: 155, avg_pace: '5:00' },
      { date: '2026-08-15', discipline: 'strength', actual_duration_min: 60, actual_distance_km: null, avg_hr: null, avg_pace: null },
      { date: '2026-09-05', discipline: 'run', actual_duration_min: 45, actual_distance_km: 9, avg_hr: 148, avg_pace: '5:00' },
    ],
  },
  {
    name: 'unparseable pace + missing fields',
    rows: [
      { date: '2026-09-20', discipline: 'run', actual_duration_min: null, actual_distance_km: 5, avg_hr: null, avg_pace: 'n/a' },
    ],
  },
];

describe('recentTraining client/edge parity', () => {
  for (const fixture of fixtures) {
    it(`computeRecentTraining matches for: ${fixture.name}`, () => {
      const clientResult = clientCompute(fixture.rows as never, today);
      const edgeResult = edgeCompute(fixture.rows as never, today);
      expect(clientResult).toEqual(edgeResult);
    });

    it(`isReturnFromLayoff matches for: ${fixture.name}`, () => {
      const clientResult = clientCompute(fixture.rows as never, today);
      expect(clientIsLayoff(clientResult)).toEqual(edgeIsLayoff(clientResult));
    });
  }
});
