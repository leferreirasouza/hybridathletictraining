import { describe, it, expect } from 'vitest';
import { toMonday, sessionDate, inferStartMonday } from '@/lib/weekBuilder';

describe('weekBuilder dates', () => {
  it('snaps a Sunday back to its Monday', () => {
    expect(toMonday('2026-10-11')).toBe('2026-10-05');
  });
  it('week 2 Sunday is 13 days after the first Monday', () => {
    expect(sessionDate('2026-10-05', 2, 7)).toBe('2026-10-18');
  });
  it('infers the first Monday from a week-3 session', () => {
    expect(inferStartMonday([{ date: '2026-10-21', week_number: 3 }])).toBe('2026-10-05');
  });
  it('returns null when no session has a date', () => {
    expect(inferStartMonday([{ date: null, week_number: 1 }])).toBeNull();
  });
});
