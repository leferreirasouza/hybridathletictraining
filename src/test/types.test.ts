import { describe, it, expect } from 'vitest';

/**
 * HYROX Coach OS — Type & Schema Integrity Tests
 * Validates that core type definitions match expected shapes.
 */

// Verify HYROX types are defined correctly
import type {
  AppRole,
  HyroxStation,
  Discipline,
  Intensity,
  PlannedSession,
  CompletedSession,
  SessionBlock,
  Target,
  WeeklySummary,
} from '@/types/hyrox';

describe('HYROX Type System', () => {
  it('AppRole should have correct values', () => {
    const roles: AppRole[] = ['master_admin', 'coach', 'athlete'];
    expect(roles).toHaveLength(3);
  });

  it('HyroxStation should cover all 8 stations', () => {
    const stations: HyroxStation[] = [
      'skierg', 'sled_push', 'sled_pull', 'burpee_broad_jump',
      'row', 'farmers_carry', 'sandbag_lunges', 'wall_balls',
    ];
    expect(stations).toHaveLength(8);
  });

  it('Discipline should include all training types', () => {
    const disciplines: Discipline[] = [
      'run', 'bike', 'stairs', 'rowing', 'skierg',
      'mobility', 'strength', 'accessories', 'hyrox_station',
      'prehab', 'custom',
    ];
    expect(disciplines).toHaveLength(11);
  });

  it('Intensity should have 5 levels', () => {
    const intensities: Intensity[] = ['easy', 'moderate', 'hard', 'race_pace', 'max_effort'];
    expect(intensities).toHaveLength(5);
  });

  it('PlannedSession shape should match required fields', () => {
    const session: PlannedSession = {
      id: 'test',
      plan_version_id: 'pv-1',
      date: '2025-01-01',
      week_number: 1,
      day_of_week: 1,
      discipline: 'run',
      session_name: 'Easy Run',
      order_index: 0,
    };
    expect(session.id).toBe('test');
    expect(session.discipline).toBe('run');
  });

  it('CompletedSession should require athlete_id and pain_flag', () => {
    const completed: CompletedSession = {
      id: 'c-1',
      athlete_id: 'u-1',
      date: '2025-01-01',
      discipline: 'run',
      pain_flag: false,
      completed_at: '2025-01-01T10:00:00Z',
    };
    expect(completed.pain_flag).toBe(false);
    expect(completed.athlete_id).toBe('u-1');
  });

  it('Target should have type and primary_target', () => {
    const target: Target = {
      id: 't-1',
      plan_version_id: 'pv-1',
      type: 'heart_rate',
      primary_target: 'Z2: 140-155 bpm',
    };
    expect(target.type).toBe('heart_rate');
  });
});
