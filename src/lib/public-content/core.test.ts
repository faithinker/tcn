import { describe, expect, it } from 'vitest';
import type { Post } from '../db/types';
import { siteToday } from '../seminars/model';
import {
  buildSnapshot,
  decideRefresh,
  emptySnapshot,
  kstToday,
  parseD1CliRows,
  parseFingerprintDoc,
  resolveContentSource,
  seminarFingerprint,
  toPosts,
} from './core';

const post = (overrides: Partial<Post> = {}): Post => ({
  id: 'a',
  title: 'First International Seminar',
  summary: 'summary',
  eventDate: '2026-10-30',
  address: 'Seoul',
  body: 'body',
  heroMediaId: null,
  authorId: null,
  revision: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
  ...overrides,
});

describe('kstToday', () => {
  it.each([
    ['2026-10-15T14:59:59Z', '2026-10-15'],
    ['2026-10-15T15:00:00Z', '2026-10-16'],
    ['2026-12-31T15:00:00Z', '2027-01-01'],
  ])('%s is %s in Seoul and matches siteToday', (instant, expected) => {
    const now = new Date(instant);
    expect(kstToday(now)).toBe(expected);
    expect(kstToday(now)).toBe(siteToday(now));
  });
});

describe('seminarFingerprint', () => {
  const today = '2026-10-15';

  it('is a stable sha-256 hex digest', async () => {
    const first = await seminarFingerprint([post()], today);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(await seminarFingerprint([post()], today)).toBe(first);
  });

  it('does not depend on row order', async () => {
    const a = post({ id: 'a', eventDate: '2026-01-01' });
    const b = post({ id: 'b', eventDate: '2026-02-01' });
    expect(await seminarFingerprint([a, b], today)).toBe(await seminarFingerprint([b, a], today));
  });

  it.each([
    ['id', { id: 'other' }],
    ['title', { title: 'Renamed' }],
    ['summary', { summary: 'changed' }],
    ['summary removed', { summary: null }],
    ['eventDate', { eventDate: '2026-11-01' }],
    ['address', { address: 'Busan' }],
  ] as const)('changes when the %s changes', async (_label, change) => {
    expect(await seminarFingerprint([post(change)], today)).not.toBe(
      await seminarFingerprint([post()], today),
    );
  });

  it('changes when a seminar is added, removed, or the KST date rolls over', async () => {
    const base = await seminarFingerprint([post()], today);
    expect(
      await seminarFingerprint([post(), post({ id: 'b', eventDate: '2027-01-01' })], today),
    ).not.toBe(base);
    expect(await seminarFingerprint([], today)).not.toBe(base);
    expect(await seminarFingerprint([post()], '2026-10-16')).not.toBe(base);
  });

  it('ignores fields the static pages never render', async () => {
    const base = await seminarFingerprint([post()], today);
    const edited = post({
      body: 'a completely different body',
      revision: 9,
      updatedAt: 999,
      heroMediaId: 'hero',
      authorId: 'someone',
    });
    expect(await seminarFingerprint([edited], today)).toBe(base);
  });
});

describe('buildSnapshot / emptySnapshot', () => {
  it('records the source, base date and fingerprint of the posts', async () => {
    const now = new Date('2026-10-15T01:02:03Z');
    const posts = [post()];
    const snapshot = await buildSnapshot({ posts, source: 'remote', today: '2026-10-15', now });
    expect(snapshot).toEqual({
      schema: 1,
      source: 'remote',
      generatedAt: '2026-10-15T01:02:03.000Z',
      today: '2026-10-15',
      fingerprint: await seminarFingerprint(posts, '2026-10-15'),
      posts,
    });
  });

  it('builds an empty snapshot dated in Seoul', async () => {
    const snapshot = await emptySnapshot(new Date('2026-10-15T15:30:00Z'));
    expect(snapshot.source).toBe('empty');
    expect(snapshot.posts).toEqual([]);
    expect(snapshot.today).toBe('2026-10-16');
  });
});

describe('parseD1CliRows', () => {
  it('returns the results array of the first statement', () => {
    const stdout = JSON.stringify([{ results: [{ id: 'a' }], success: true, meta: {} }]);
    expect(parseD1CliRows(stdout)).toEqual([{ id: 'a' }]);
  });

  it.each([
    ['not json', 'Unexpected token', 'did not print JSON'],
    ['an object', '{"results":[]}', 'no results array'],
    ['an empty array', '[]', 'no results array'],
    ['a missing results key', '[{"success":true}]', 'no results array'],
  ])('rejects %s', (_label, stdout, message) => {
    expect(() => parseD1CliRows(stdout)).toThrow(message);
  });
});

describe('toPosts', () => {
  it('accepts rows shaped like listSeminarPosts output', () => {
    const rows = [post(), post({ id: 'b', summary: null, address: null })];
    expect(toPosts(rows)).toEqual(rows);
  });

  it.each([
    ['null', null],
    ['a missing id', { ...post(), id: undefined }],
    ['an undated post', { ...post(), eventDate: null }],
    ['an empty event date', { ...post(), eventDate: '' }],
    ['a soft-deleted post', { ...post(), deletedAt: 5 }],
    ['a non-numeric revision', { ...post(), revision: '1' }],
    ['a numeric title', { ...post(), title: 7 }],
  ])('rejects %s', (_label, row) => {
    expect(() => toPosts([row])).toThrow('row 0 does not match the Post shape');
  });
});

describe('resolveContentSource', () => {
  it('requires the remote production D1 when TCN_REQUIRE_CONTENT=1', () => {
    expect(
      resolveContentSource({ TCN_REQUIRE_CONTENT: '1', CLOUDFLARE_API_TOKEN: 't' }, true),
    ).toEqual({ mode: 'remote', required: true, fallbackToEmpty: false });
  });

  it('refuses to build for production without credentials or with another source', () => {
    expect(() => resolveContentSource({ TCN_REQUIRE_CONTENT: '1' }, true)).toThrow(
      'needs CLOUDFLARE_API_TOKEN',
    );
    expect(() =>
      resolveContentSource(
        { TCN_REQUIRE_CONTENT: '1', CLOUDFLARE_API_TOKEN: 't', TCN_CONTENT_SOURCE: 'local' },
        true,
      ),
    ).toThrow('only allows the remote production D1');
    expect(() =>
      resolveContentSource(
        { TCN_REQUIRE_CONTENT: '1', CLOUDFLARE_API_TOKEN: 't', TCN_CONTENT_SOURCE: 'empty' },
        true,
      ),
    ).toThrow('only allows the remote production D1');
  });

  it('rejects an unknown TCN_CONTENT_SOURCE', () => {
    expect(() => resolveContentSource({ TCN_CONTENT_SOURCE: 'prod' }, false)).toThrow(
      'must be remote, local or empty',
    );
  });

  it('honours an explicit source without a silent fallback', () => {
    expect(resolveContentSource({ TCN_CONTENT_SOURCE: 'local' }, false)).toEqual({
      mode: 'local',
      required: false,
      fallbackToEmpty: false,
    });
    expect(resolveContentSource({ TCN_CONTENT_SOURCE: 'empty' }, true).mode).toBe('empty');
  });

  it('picks remote when a token exists, else local state, else empty', () => {
    expect(resolveContentSource({ CLOUDFLARE_API_TOKEN: 't' }, true).mode).toBe('remote');
    expect(resolveContentSource({}, true)).toEqual({
      mode: 'local',
      required: false,
      fallbackToEmpty: true,
    });
    expect(resolveContentSource({}, false)).toEqual({
      mode: 'empty',
      required: false,
      fallbackToEmpty: false,
    });
  });
});

describe('parseFingerprintDoc / decideRefresh', () => {
  const doc = (fingerprint: string, today: string) => ({ fingerprint, today });

  it('parses a fingerprint document and ignores extra keys', () => {
    expect(
      parseFingerprintDoc('{"fingerprint":"f","today":"2026-10-15","source":"remote"}', 'x'),
    ).toEqual(doc('f', '2026-10-15'));
  });

  it.each([
    ['not json', '<html>challenge</html>'],
    ['a missing fingerprint', '{"today":"2026-10-15"}'],
    ['a missing date', '{"fingerprint":"f"}'],
    ['null', 'null'],
  ])('rejects %s instead of guessing', (_label, text) => {
    expect(() => parseFingerprintDoc(text, 'live fingerprint')).toThrow('live fingerprint');
  });

  it('leaves matching pages alone', () => {
    expect(decideRefresh(doc('same', '2026-10-15'), doc('same', '2026-10-15'))).toEqual({
      rebuild: false,
      reason: 'up to date',
    });
  });

  it('rebuilds when the seminars changed on the same day', () => {
    expect(decideRefresh(doc('new', '2026-10-15'), doc('old', '2026-10-15'))).toEqual({
      rebuild: true,
      reason: 'content changed',
    });
  });

  it('rebuilds when the Seoul date rolled over', () => {
    expect(decideRefresh(doc('new', '2026-10-16'), doc('old', '2026-10-15'))).toEqual({
      rebuild: true,
      reason: 'KST date changed',
    });
  });
});
