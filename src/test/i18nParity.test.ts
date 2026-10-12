import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import ptBR from '@/i18n/locales/pt-BR.json';
import autoEn from '@/i18n/locales/auto-en.json';
import autoPtBR from '@/i18n/locales/auto-pt-BR.json';

function keys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('translation dictionaries', () => {
  it('keeps English and Brazilian Portuguese keys in parity', () => {
    expect(keys(ptBR).sort()).toEqual(keys(en).sort());
    expect(keys(autoPtBR).sort()).toEqual(keys(autoEn).sort());
  });

  it('contains a Portuguese value for every extracted interface string', () => {
    expect(Object.values(autoPtBR).every((value) => typeof value === 'string' && value.trim().length > 0)).toBe(true);
  });
});