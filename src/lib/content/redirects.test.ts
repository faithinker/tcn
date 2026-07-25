import { describe, expect, it } from 'vitest';

import { buildRedirectLines, mergeRedirectsFile } from './redirects';
import type { PublicContentSnapshot, PublicSeminar } from './types';

const seminar = (overrides: Partial<PublicSeminar> = {}): PublicSeminar => ({
  id: 'seminar-1',
  sequence: 1,
  locale: 'ko',
  legacySlug: '2025-laos',
  title: '제1차 세미나',
  startsAt: '2025-12-26T00:00:00Z',
  eventStatus: 'completed',
  temporalStatus: 'past',
  placeName: '루앙프라방',
  ...overrides,
});

const snapshot = (overrides: Partial<PublicContentSnapshot> = {}): PublicContentSnapshot => ({
  source: 'json',
  seminars: [seminar()],
  posts: [],
  aliases: [],
  history: [],
  ...overrides,
});

describe('buildRedirectLines', () => {
  it('emits Cloudflare 301 lines for DB aliases and legacy slugs, targets trailing-slashed', () => {
    const lines = buildRedirectLines(
      snapshot({
        aliases: [
          { locale: 'ko', from: '/ko/seminars/1/news/3-old-slug', to: '/ko/seminars/1/reports/3-old-slug' },
        ],
      }),
    );
    expect(lines).toContain('/ko/seminars/1/news/3-old-slug /ko/seminars/1/reports/3-old-slug/ 301');
    expect(lines).toContain('/ko/seminars/2025-laos /ko/seminars/1/ 301');
  });

  it('returns no lines when there is nothing to alias', () => {
    expect(buildRedirectLines(snapshot({ seminars: [seminar({ legacySlug: undefined })] }))).toEqual([]);
  });
});

describe('mergeRedirectsFile', () => {
  const existing = [
    '# hand-maintained rules',
    '/ko/seminars/2025-laos                        /ko/seminars/1/         301',
    '/seminars/*                                   /ko/seminars/:splat    301',
  ].join('\n');

  it('appends a marked generated section, skipping sources the file already handles', () => {
    const merged = mergeRedirectsFile(existing, [
      '/ko/seminars/2025-laos /ko/seminars/1/ 301',
      '/ko/seminars/1/news/3-old-slug /ko/seminars/1/reports/3-old-slug/ 301',
    ]);
    // hand-maintained rule kept once, not duplicated by the generator
    expect(merged.match(/2025-laos/g)).toHaveLength(1);
    expect(merged).toContain('# BEGIN content-aliases (generated)');
    expect(merged).toContain('/ko/seminars/1/news/3-old-slug /ko/seminars/1/reports/3-old-slug/ 301');
    expect(merged).toContain('# END content-aliases');
    expect(merged.startsWith('# hand-maintained rules')).toBe(true);
  });

  it('is idempotent: rewriting replaces the generated section instead of stacking', () => {
    const once = mergeRedirectsFile(existing, ['/ko/seminars/old /ko/seminars/2/ 301']);
    const twice = mergeRedirectsFile(once, ['/ko/seminars/old /ko/seminars/2/ 301']);
    expect(twice).toBe(once);
    expect(twice.match(/BEGIN content-aliases/g)).toHaveLength(1);
  });

  it('drops the generated section when no lines remain', () => {
    const once = mergeRedirectsFile(existing, ['/ko/seminars/old /ko/seminars/2/ 301']);
    const cleared = mergeRedirectsFile(once, []);
    expect(cleared).not.toContain('content-aliases');
    expect(cleared.trimEnd()).toBe(existing.trimEnd());
  });
});
