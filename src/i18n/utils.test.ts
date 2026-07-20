import { describe, it, expect } from 'vitest';
import {
  getLangFromUrl,
  useTranslations,
  localizePath,
  stripLangPrefix,
  switchLangPath,
  formatDate
} from './utils';

describe('i18n utils', () => {
  describe('getLangFromUrl', () => {
    it('should return correct language from URL', () => {
      expect(getLangFromUrl(new URL('https://example.com/ko/about'))).toBe('ko');
      expect(getLangFromUrl(new URL('https://example.com/en/about'))).toBe('en');
    });

    it('should fallback to default language for unknown language segments', () => {
      expect(getLangFromUrl(new URL('https://example.com/fr/about'))).toBe('ko');
      expect(getLangFromUrl(new URL('https://example.com/'))).toBe('ko');
    });
  });

  describe('useTranslations', () => {
    it('should return the translation for specified language', () => {
      const tKo = useTranslations('ko');
      const tEn = useTranslations('en');

      expect(tKo('site.abbr')).toBe('TCN');
      expect(tEn('nav.home')).toBe('Home');
      expect(tKo('nav.home')).toBe('홈');
    });
  });

  describe('localizePath', () => {
    it('should localize path correctly', () => {
      expect(localizePath('/about', 'ko')).toBe('/ko/about');
      expect(localizePath('about', 'en')).toBe('/en/about');
      expect(localizePath('/', 'en')).toBe('/en/');
    });
  });

  describe('stripLangPrefix', () => {
    it('should strip language prefix from pathnames', () => {
      expect(stripLangPrefix('/ko/about')).toBe('/about');
      expect(stripLangPrefix('/en/about/founding')).toBe('/about/founding');
      expect(stripLangPrefix('/ko/')).toBe('/');
      expect(stripLangPrefix('/about')).toBe('/about');
      expect(stripLangPrefix('/')).toBe('/');
    });
  });

  describe('switchLangPath', () => {
    it('should switch language of path correctly', () => {
      expect(switchLangPath('/ko/about', 'en')).toBe('/en/about');
      expect(switchLangPath('/en/about/founding', 'ko')).toBe('/ko/about/founding');
      expect(switchLangPath('/ko/', 'en')).toBe('/en/');
    });
  });

  describe('formatDate', () => {
    it('should format date correctly according to language', () => {
      expect(formatDate('2025-10-15', 'ko')).toBe('2025년 10월 15일');
      expect(formatDate('2025-10-15', 'en')).toBe('October 15, 2025');
    });

    it('should return original string if date format is invalid', () => {
      expect(formatDate('invalid-date', 'ko')).toBe('invalid-date');
    });
  });
});
