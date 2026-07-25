import { describe, expect, it } from 'vitest';

import {
  buildCanonicalAliases,
  createAliasRouteEntries,
  createPostRouteEntries,
  createSeminarRouteEntries,
  createSitemapPaths,
  postPath,
  seminarHubPath,
} from './routes';
import type { PublicContentSnapshot, PublicPost, PublicSeminar } from './types';

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

const post = (overrides: Partial<PublicPost> = {}): PublicPost => ({
  id: 'post-1',
  seminarId: 'seminar-1',
  seminarSequence: 1,
  postNo: 2,
  kind: 'report',
  locale: 'ko',
  title: '활동 보고',
  slug: 'activity-report',
  body: { type: 'doc', content: [] },
  translationStatus: 'source',
  ...overrides,
});

describe('canonical seminar routes', () => {
  it('uses the seminar sequence as the single public detail identifier', () => {
    expect(seminarHubPath('ko', 1)).toBe('/ko/seminars/1');
    expect(postPath('en', 1, 'report', 2, 'activity-report')).toBe(
      '/en/seminars/activities/1',
    );
    expect(postPath('ko', 3, 'activity', 4, 'field-notes')).toBe(
      '/ko/seminars/activities/3',
    );
  });

  it('rejects invalid permanent identifiers and slugs', () => {
    expect(() => seminarHubPath('ko', 0)).toThrow(/sequence/i);
    expect(() => postPath('ko', 1, 'report', -1, 'valid-slug')).toThrow(/post/i);
    expect(() => postPath('ko', 1, 'report', 1, '../escape')).toThrow(/slug/i);
  });
});

describe('static route entries', () => {
  const snapshot: PublicContentSnapshot = {
    source: 'supabase',
    seminars: [
      seminar(),
      seminar({ id: 'seminar-1-en', locale: 'en', title: 'First Seminar' }),
      seminar({ id: 'seminar-2', sequence: 2, legacySlug: '2026-korea', title: '제2차 세미나' }),
    ],
    posts: [post(), post({ id: 'post-en', locale: 'en', title: 'Activity report' })],
    history: [],
    aliases: [
      {
        locale: 'ko',
        from: '/ko/seminars/1/reports/2-old-title',
        to: '/ko/seminars/1/reports/2-activity-report',
      },
    ],
  };

  it('emits locale-scoped sequence hubs and published post pages', () => {
    expect(createSeminarRouteEntries(snapshot, 'ko').map((entry) => entry.params)).toEqual([
      { sequence: '1' },
      { sequence: '2' },
    ]);
    expect(createPostRouteEntries(snapshot, 'en').map((entry) => entry.params)).toEqual([
      { sequence: '1', kind: 'reports', post: '2-activity-report' },
    ]);
  });

  it('maps legacy seminar slugs and stored URL aliases to canonical URLs', () => {
    expect(buildCanonicalAliases(snapshot)).toEqual([
      { locale: 'en', from: '/en/seminars/2025-laos', to: '/en/seminars/1' },
      {
        locale: 'ko',
        from: '/ko/seminars/1/reports/2-old-title',
        to: '/ko/seminars/1/reports/2-activity-report',
      },
      { locale: 'ko', from: '/ko/seminars/2025-laos', to: '/ko/seminars/1' },
      { locale: 'ko', from: '/ko/seminars/2026-korea', to: '/ko/seminars/2' },
    ]);
  });

  it('turns aliases into localized rest-route entries that issue permanent redirects', () => {
    expect(createAliasRouteEntries(snapshot, 'ko')).toEqual([
      {
        params: { alias: '1/reports/2-old-title' },
        props: { target: '/ko/seminars/1/reports/2-activity-report/', status: 301 },
      },
      {
        params: { alias: '2025-laos' },
        props: { target: '/ko/seminars/1/', status: 301 },
      },
      {
        params: { alias: '2026-korea' },
        props: { target: '/ko/seminars/2/', status: 301 },
      },
    ]);
  });

  it('lists only canonical sequence hubs and published post URLs in the sitemap', () => {
    const paths = createSitemapPaths(snapshot);

    expect(paths).toContain('/ko/seminars/1/');
    expect(paths).toContain('/en/seminars/activities/1/');
    expect(paths).not.toContain('/ko/seminars/2025-laos/');
    expect(paths).not.toContain('/ko/seminars/1/reports/2-old-title/');
  });
});
