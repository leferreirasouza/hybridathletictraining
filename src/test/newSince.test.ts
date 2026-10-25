import { describe, it, expect } from 'vitest';
import { formatNewSince, NEW_SINCE_LIMIT, type NewSinceItem } from '../../supabase/functions/_shared/newSince.ts';

const item = (date: string, extra: Partial<NewSinceItem> = {}): NewSinceItem => ({
  date,
  discipline: 'run',
  minutes: 45,
  km: 9.04,
  source: 'strava',
  ...extra,
});

describe('formatNewSince', () => {
  it('is empty when nothing is new', () => {
    expect(formatNewSince('2026-10-20T10:00:00Z', [], 0)).toBe('');
  });

  it('lists sessions newest first with source and quality notes', () => {
    const text = formatNewSince('2026-10-20T10:00:00Z', [
      item('2026-10-21'),
      item('2026-10-23', { discipline: 'strength', km: null, source: 'manual' }),
      item('2026-10-22', { note: ' [indoor, distance/pace estimated]' }),
    ], 3);
    const lines = text.split('\n');
    expect(lines[0]).toBe('NEW SINCE YOUR LAST CONVERSATION (2026-10-20): 3 sessions synced or logged since the athlete last messaged you.');
    expect(lines[1]).toBe('- 2026-10-23: strength | 45 min | logged manually');
    expect(lines[2]).toBe('- 2026-10-22: run | 45 min | 9.0 km [indoor, distance/pace estimated]');
    expect(lines[3]).toBe('- 2026-10-21: run | 45 min | 9.0 km');
    expect(text).toContain('never mention sessions that are not shown here');
  });

  it('caps the list and says how many were left out', () => {
    const items = Array.from({ length: 12 }, (_, i) => item(`2026-10-${String(10 + i).padStart(2, '0')}`));
    const text = formatNewSince('2026-10-01T00:00:00Z', items, 15);
    expect(text.split('\n').filter((l) => l.startsWith('- 2026')).length).toBe(NEW_SINCE_LIMIT);
    expect(text).toContain('- …and 7 more');
    expect(text).toContain(': 15 sessions synced');
  });

  it('uses the singular for one session', () => {
    expect(formatNewSince('2026-10-20T10:00:00Z', [item('2026-10-21')], 1)).toContain(': 1 session synced');
  });
});
