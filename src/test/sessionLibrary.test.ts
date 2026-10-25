import { describe, it, expect } from 'vitest';
import {
  effectiveLibrary,
  formatLibraryCatalogue,
  resolveLibraryCodes,
  type LibraryEntry,
} from '../../supabase/functions/_shared/sessionLibrary.ts';

const entry = (code: string, extra: Partial<LibraryEntry> = {}): LibraryEntry => ({
  id: `g-${code}`,
  organization_id: null,
  code,
  name: code.toLowerCase(),
  slot_type: 'run',
  subtype: 'easy',
  intensity: 'easy',
  objective: 'objective',
  ...extra,
});

const lib = [
  entry('RUN_EASY'),
  entry('RUN_TEMPO', { subtype: 'tempo', intensity: 'hard' }),
  entry('STR_FULL_BODY', { slot_type: 'strength', subtype: 'full_body', intensity: 'moderate' }),
  entry('HYX_FULL_SIM', { slot_type: 'hyrox', subtype: 'simulation', intensity: 'race_pace' }),
  // Org override of a global code.
  entry('RUN_EASY', { id: 'org-RUN_EASY', organization_id: 'org-1', name: 'club easy run' }),
];

describe('sessionLibrary', () => {
  it('lets an org entry override the global entry with the same code', () => {
    const eff = effectiveLibrary(lib);
    expect(eff).toHaveLength(4);
    expect(eff.find((e) => e.code === 'RUN_EASY')?.id).toBe('org-RUN_EASY');
  });

  it('formats a grouped one-line-per-entry catalogue', () => {
    const text = formatLibraryCatalogue(lib);
    expect(text.split('\n')).toEqual([
      'RUN slots:',
      '  RUN_EASY · club easy run · easy · easy — objective',
      '  RUN_TEMPO · run_tempo · tempo · hard — objective',
      'STRENGTH slots:',
      '  STR_FULL_BODY · str_full_body · full_body · moderate — objective',
      'HYROX-specific sessions:',
      '  HYX_FULL_SIM · hyx_full_sim · simulation · race_pace — objective',
    ]);
    expect(formatLibraryCatalogue([])).toBe('');
  });

  it('truncates long objectives', () => {
    const text = formatLibraryCatalogue([entry('RUN_LONG', { objective: 'x'.repeat(200) })]);
    expect(text.split('\n')[1].endsWith('…')).toBe(true);
    expect(text.split('\n')[1].length).toBeLessThan(140);
  });

  it('resolves codes case-insensitively and counts unknown or missing ones', () => {
    const r = resolveLibraryCodes(['run_tempo', ' RUN_EASY ', 'NOPE', null, undefined, ''], lib);
    expect(r.ids).toEqual(['g-RUN_TEMPO', 'org-RUN_EASY', null, null, null, null]);
    expect(r.unmatched).toBe(4);
    expect(r.unknownCodes).toEqual(['NOPE']);
  });
});
