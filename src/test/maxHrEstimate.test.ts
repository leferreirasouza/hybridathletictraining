import { describe, it, expect } from 'vitest';
import {
  effectiveMaxHr,
  estimateMaxHr,
  maxHrAdvice,
} from '../../supabase/functions/_shared/maxHrEstimate.ts';

// Shape of the owner's real data (2026-10-25): top session maxima
// 211, 209 (strap spikes), then 199, 198, 197, 197, 196, 196 …
const owner = [211, 209, 199, 198, 197, 197, 196, 196, ...Array.from({ length: 217 }, (_, i) => 150 + (i % 45))];

describe('maxHrEstimate', () => {
  it('takes the 98th percentile so one-off spikes do not set the max', () => {
    expect(estimateMaxHr(owner)).toEqual({ bpm: 197, sampleSize: 225 });
  });

  it('needs at least 20 plausible sessions', () => {
    expect(estimateMaxHr(Array(19).fill(180))).toBeNull();
    expect(estimateMaxHr([...Array(19).fill(180), 250, 90, null])).toBeNull();
    expect(estimateMaxHr(Array(20).fill(180))?.bpm).toBe(180);
  });

  it('suggests the estimate when no max is set, or asks for one', () => {
    expect(maxHrAdvice(null, { bpm: 192, sampleSize: 40 })).toEqual({ kind: 'use_estimate', bpm: 192, sampleSize: 40 });
    expect(maxHrAdvice(null, null)).toEqual({ kind: 'enter' });
  });

  it('suggests raising a profile max only when data clearly exceeds it', () => {
    expect(maxHrAdvice(194, { bpm: 197, sampleSize: 225 })).toEqual({ kind: 'raise', bpm: 197, current: 194, sampleSize: 225 });
    expect(maxHrAdvice(194, { bpm: 196, sampleSize: 225 })).toEqual({ kind: 'none' });
    expect(maxHrAdvice(194, null)).toEqual({ kind: 'none' });
  });

  it('prefers the confirmed profile value for plausibility checks', () => {
    expect(effectiveMaxHr(185, { bpm: 197, sampleSize: 50 })).toBe(185);
    expect(effectiveMaxHr(null, { bpm: 197, sampleSize: 50 })).toBe(197);
    expect(effectiveMaxHr(null, null)).toBeNull();
  });
});
