import { describe, expect, it } from 'vitest';

import { formatDate, getLangFromUrl, localizePath } from './utils';

// 영어 단일 심(shim) — 시그니처는 유지하되 프리픽스 없는 루트 트리를 가리킨다.
describe('single-language i18n shim', () => {
  it('always resolves to en regardless of URL', () => {
    expect(getLangFromUrl(new URL('https://x.test/ko/about'))).toBe('en');
    expect(getLangFromUrl(new URL('https://x.test/'))).toBe('en');
    expect(getLangFromUrl()).toBe('en');
  });

  it('localizePath returns prefix-free root paths', () => {
    expect(localizePath('/about')).toBe('/about');
    expect(localizePath('about')).toBe('/about');
    expect(localizePath('/')).toBe('/');
  });

  it('formatDate renders English dates from ISO date or timestamp', () => {
    expect(formatDate('2026-10-30')).toBe('October 30, 2026');
    expect(formatDate('2025-12-26T00:00:00Z')).toBe('December 26, 2025');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});
