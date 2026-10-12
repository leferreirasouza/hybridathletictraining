import { describe, it, expect } from 'vitest';
import { sessionState, buildWeekProgress } from '@/lib/planProgress';

const base = { week_number: 1, day_of_week: 1, discipline: 'run', session_name: 'Run' };

describe('plan progress', () => {
  it('completed session is completed even if the date has passed', () => {
    expect(sessionState({ ...base, id: 'a', date: '2026-10-01' }, new Set(['a']), '2026-10-12')).toBe('completed');
  });
  it("today's unlogged session is in progress", () => {
    expect(sessionState({ ...base, id: 'a', date: '2026-10-12' }, new Set(), '2026-10-12')).toBe('in_progress');
  });
  it('past unlogged session is missed, future is planned', () => {
    expect(sessionState({ ...base, id: 'a', date: '2026-10-11' }, new Set(), '2026-10-12')).toBe('missed');
    expect(sessionState({ ...base, id: 'a', date: '2026-10-13' }, new Set(), '2026-10-12')).toBe('planned');
  });
  it('week totals count done sessions and done km', () => {
    const weeks = buildWeekProgress(
      [
        { ...base, id: 'a', date: '2026-10-05', distance_km: 10 },
        { ...base, id: 'b', day_of_week: 3, date: '2026-10-07', distance_km: 8 },
      ],
      [{ planned_session_id: 'a', actual_distance_km: 11.5 }],
      '2026-10-06',
    );
    expect(weeks[0].done).toBe(1);
    expect(weeks[0].total).toBe(2);
    expect(weeks[0].plannedKm).toBe(18);
    expect(weeks[0].doneKm).toBe(11.5);
    expect(weeks[0].isCurrent).toBe(true);
  });
});
