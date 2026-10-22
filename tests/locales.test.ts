import { describe, expect, it } from 'vitest';
import { en, localeNames, translator } from '../src/i18n';
import { translations } from '../src/locales';
import type { Locale } from '../src/types';
describe('locale completeness', () => {
  for (const locale of Object.keys(localeNames).filter(locale => locale !== 'en') as Locale[]) {
    it(`${locale} supplies every interface string without English spread fallbacks`, () => {
      expect(Object.keys(translations[locale]!).sort()).toEqual(Object.keys(en).sort());
      for (const value of Object.values(translations[locale]!)) expect(value.trim().length).toBeGreaterThan(0);
      expect(translator(locale)('saveError')).not.toBe(en.saveError);
      expect(translator(locale)('crashReportsBody')).not.toBe(en.crashReportsBody);
    });
  }
  it('retains readable English for unknown keys in a supported dictionary', () => {
    expect(translator('en')('home')).toBe('Home');
    expect(translator('es')('notARealKey')).toBe('notARealKey');
  });
});
