import { describe, it, expect } from 'vitest';
import {
  activityFlags,
  effectiveDurationSec,
  hrFlags,
  isHyroxEffort,
  isHyroxRaceImport,
  isRace,
  isSameEffort,
  overlapFraction,
  paceUntrusted,
  unionFlags,
} from '../../supabase/functions/_shared/activityQuality.ts';

// Shapes taken from real stored payloads (2026-10-25), ids/ranks stripped.
const roxfitRace = {
  sport_type: 'Run',
  name: 'HYROX - São Paulo - 01:13:44',
  external_id: 'roxfit-hyrox-ABC123.fit',
  trainer: true,
  moving_time: 2820,
  elapsed_time: 4424,
  distance: 8700,
};
const watchRaceRecording = {
  sport_type: 'Run',
  name: 'Hyrox Buenos Aires',
  external_id: 'garmin_ping_1',
  workout_type: 1,
  trainer: true,
  moving_time: 4620,
  elapsed_time: 4620,
  distance: 10400,
  average_heartrate: 144,
  max_heartrate: 191,
};
const treadmillRun = {
  sport_type: 'Run',
  name: 'Morning Run',
  trainer: true,
  moving_time: 2400,
  elapsed_time: 2450,
  distance: 7000,
  average_heartrate: 150,
  max_heartrate: 172,
};
const halfMarathon = {
  sport_type: 'Run',
  name: 'Meia Maratona de São Paulo',
  workout_type: 1,
  trainer: false,
  moving_time: 7320,
  elapsed_time: 9540,
  distance: 21300,
};

describe('HYROX classification', () => {
  it('recognises a ROXFIT race import by external_id or name', () => {
    expect(isHyroxRaceImport(roxfitRace)).toBe(true);
    expect(isHyroxRaceImport({ name: 'HYROX - Washington DC - 01:15:03' })).toBe(true);
    expect(isHyroxRaceImport({ name: 'Hyrox Buenos Aires' })).toBe(false);
  });

  it('treats long HYROX-named runs as HYROX efforts, short ones as runs', () => {
    expect(isHyroxEffort(watchRaceRecording)).toBe(true);
    expect(isHyroxEffort({ sport_type: 'Run', name: 'Simulado Hyrox', moving_time: 2940 })).toBe(true);
    expect(isHyroxEffort({ sport_type: 'Run', name: 'Hyrox run warm-up', moving_time: 900 })).toBe(false);
    expect(isHyroxEffort(treadmillRun)).toBe(false);
    // Non-run sports keep the existing name-hint mapping in stravaMap.ts.
    expect(isHyroxEffort({ sport_type: 'HighIntensityIntervalTraining', name: 'Hyrox', moving_time: 4000 })).toBe(false);
  });

  it('uses the official elapsed time for race imports and moving time otherwise', () => {
    expect(effectiveDurationSec(roxfitRace)).toBe(4424);
    expect(effectiveDurationSec(halfMarathon)).toBe(7320);
    expect(effectiveDurationSec({ elapsed_time: 600 })).toBe(600);
  });

  it('flags races from workout_type and race imports', () => {
    expect(isRace(halfMarathon)).toBe(true);
    expect(isRace(roxfitRace)).toBe(true);
    expect(isRace({ workout_type: 11 })).toBe(true);
    expect(isRace(treadmillRun)).toBe(false);
  });
});

describe('activityFlags', () => {
  it('marks treadmill and race-import distance as estimated', () => {
    expect(activityFlags(treadmillRun, 194)).toEqual(['distance_estimated']);
    expect(activityFlags(roxfitRace, 194)).toEqual(['race', 'distance_estimated']);
    expect(activityFlags({ sport_type: 'VirtualRide', distance: 20000 }, null)).toEqual(['distance_estimated']);
  });

  it('does not flag indoor sessions without a distance', () => {
    expect(activityFlags({ sport_type: 'WeightTraining', trainer: true, distance: 0 }, 194)).toEqual([]);
  });

  it('keeps an outdoor race as measured distance', () => {
    expect(activityFlags(halfMarathon, 194)).toEqual(['race']);
  });

  it('flags manual entries', () => {
    expect(activityFlags({ sport_type: 'Run', manual: true }, null)).toEqual(['manual_entry']);
  });
});

describe('hrFlags', () => {
  it('flags a max HR spike above the athlete max + tolerance', () => {
    expect(hrFlags(163, 211, 194)).toEqual(['max_hr_artifact']);
    expect(hrFlags(163, 204, 194)).toEqual([]);
  });

  it('falls back to generic ceilings when the athlete max is unknown', () => {
    expect(hrFlags(150, 211, null)).toEqual([]);
    expect(hrFlags(150, 221, null)).toEqual(['max_hr_artifact']);
    expect(hrFlags(201, 205, null)).toEqual(['hr_artifact']);
  });

  it('flags impossible averages', () => {
    expect(hrFlags(196, 199, 194)).toEqual(['hr_artifact']);
    expect(hrFlags(170, 160, 194)).toEqual(['hr_artifact']);
    expect(hrFlags(35, 90, 194)).toEqual(['hr_artifact']);
    expect(hrFlags(null, null, 194)).toEqual([]);
  });
});

describe('duplicate detection', () => {
  const t0 = Date.parse('2026-10-17T19:00:00Z');

  it('matches a race import with the watch recording started seconds apart', () => {
    expect(isSameEffort(t0, 4424, t0 + 7000, 4440)).toBe(true);
  });

  it('matches a short recording fully inside a longer one', () => {
    // 18-min Runna run captured inside a 71-min race recording.
    expect(overlapFraction(t0, 4260, t0 + 600_000, 1080)).toBe(1);
    expect(isSameEffort(t0, 4260, t0 + 600_000, 1080)).toBe(true);
  });

  it('keeps back-to-back sessions separate', () => {
    expect(isSameEffort(t0, 3600, t0 + 3_600_000, 3600)).toBe(false);
    // 10-min overlap of a 60-min session is a different session.
    expect(isSameEffort(t0, 3600, t0 + 3_000_000, 3600)).toBe(false);
  });

  it('ignores very short recordings', () => {
    expect(isSameEffort(t0, 3600, t0, 120)).toBe(false);
  });
});

describe('helpers', () => {
  it('unions and sorts flags', () => {
    expect(unionFlags(['race'], ['distance_estimated', 'race'], null)).toEqual(['distance_estimated', 'race']);
  });

  it('treats estimated distance and races as untrusted pace', () => {
    expect(paceUntrusted(['distance_estimated'])).toBe(true);
    expect(paceUntrusted(['race'])).toBe(true);
    expect(paceUntrusted(['max_hr_artifact'])).toBe(false);
    expect(paceUntrusted(null)).toBe(false);
  });
});
