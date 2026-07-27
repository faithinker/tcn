import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/client', () => ({ newId: vi.fn(() => 'new-id') }));

import type { Post } from '../db/types';
import {
  deriveSeminarCollection,
  formatSeminarOrdinalLabel,
  siteToday,
  type SeminarView,
} from './model';
import * as seminarDomain from './model';
import * as seminarService from './service';

const post = (id: string, eventDate: string): Post => ({
  id,
  title: `Seminar ${id}`,
  summary: null,
  eventDate,
  address: null,
  body: '',
  heroMediaId: null,
  authorId: null,
  revision: 1,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: null,
});

describe('deriveSeminarCollection', () => {
  it('sorts seminars chronologically and assigns sequence from the sorted order', () => {
    const result = deriveSeminarCollection(
      [post('second', '2026-10-30'), post('first', '2025-12-26')],
      '2026-01-01',
    );

    expect(result.chronological.map(({ id, sequence }) => ({ id, sequence }))).toEqual([
      { id: 'first', sequence: 1 },
      { id: 'second', sequence: 2 },
    ]);
  });

  it('derives today, upcoming, and held projections from one today value', () => {
    const result = deriveSeminarCollection(
      [post('held', '2025-12-26'), post('today', '2026-07-26'), post('next', '2026-10-30')],
      '2026-07-26',
    );

    expect(result.chronological.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'held', status: 'held' },
      { id: 'today', status: 'today' },
      { id: 'next', status: 'upcoming' },
    ]);
    expect(result.upcoming.map((seminar) => seminar.id)).toEqual(['today', 'next']);
    expect(result.past.map((seminar) => seminar.id)).toEqual(['held']);
    expect(result.next?.id).toBe('today');
    expect(result.latestPast?.id).toBe('held');
  });

  it('adds one canonical ordinal label and public href to every seminar view', () => {
    const posts = Array.from({ length: 11 }, (_, index) =>
      post(String(index + 1), `2026-${String(index + 1).padStart(2, '0')}-01`),
    );

    const result = deriveSeminarCollection(posts, '2025-01-01');

    expect(result.chronological[0]).toMatchObject({
      ordinalLabel: 'First International Seminar',
      href: '/seminars/2026-01-01',
    });
    expect(result.chronological[1]?.ordinalLabel).toBe('Second International Seminar');
    expect(result.chronological[2]?.ordinalLabel).toBe('Third International Seminar');
    expect(result.chronological[10]?.ordinalLabel).toBe('11th International Seminar');
  });

  it('rejects duplicate event dates instead of assigning ambiguous sequence and URLs', () => {
    expect(() =>
      deriveSeminarCollection([post('a', '2026-10-30'), post('b', '2026-10-30')], '2026-01-01'),
    ).toThrow('Duplicate seminar event date: 2026-10-30');
  });

  it('excludes undated posts and does not mutate the source array', () => {
    const source = [
      post('later', '2026-10-30'),
      { ...post('undated', '2026-01-01'), eventDate: null },
    ];
    const originalIds = source.map((item) => item.id);

    const result = deriveSeminarCollection(source, '2026-01-01');

    expect(result.chronological.map((seminar) => seminar.id)).toEqual(['later']);
    expect(source.map((item) => item.id)).toEqual(originalIds);
  });
});

describe('formatSeminarOrdinalLabel', () => {
  it('uses English numeric suffixes after the named ordinals', () => {
    expect(formatSeminarOrdinalLabel(11)).toBe('11th International Seminar');
    expect(formatSeminarOrdinalLabel(21)).toBe('21st International Seminar');
    expect(formatSeminarOrdinalLabel(22)).toBe('22nd International Seminar');
    expect(formatSeminarOrdinalLabel(23)).toBe('23rd International Seminar');
  });
});

describe('siteToday', () => {
  it('uses the Asia/Seoul calendar day instead of the UTC day', () => {
    expect(siteToday(new Date('2026-07-25T15:30:00.000Z'))).toBe('2026-07-26');
  });
});

describe('getSeminarCollection', () => {
  it('loads the shared dated-post query and derives the page projections', async () => {
    const all = async () => ({ results: [post('first', '2025-12-26')] });
    const db = { prepare: () => ({ all }) } as unknown as D1Database;
    const getSeminarCollection = (
      seminarService as {
        getSeminarCollection?: (
          db: D1Database,
          today: string,
        ) => Promise<{ chronological: Post[] }>;
      }
    ).getSeminarCollection;

    expect(getSeminarCollection).toBeTypeOf('function');
    if (!getSeminarCollection) return;

    const result = await getSeminarCollection(db, '2026-01-01');
    expect(result.chronological.map((seminar) => seminar.id)).toEqual(['first']);
  });

  it('finds one detail view by event date from the same derived collection', async () => {
    const all = async () => ({
      results: [post('first', '2025-12-26'), post('second', '2026-10-30')],
    });
    const db = { prepare: () => ({ all }) } as unknown as D1Database;
    const getSeminarByEventDate = (
      seminarService as {
        getSeminarByEventDate?: (
          db: D1Database,
          eventDate: string,
          today: string,
        ) => Promise<{ id: string; sequence: number } | null>;
      }
    ).getSeminarByEventDate;

    expect(getSeminarByEventDate).toBeTypeOf('function');
    if (!getSeminarByEventDate) return;

    await expect(getSeminarByEventDate(db, '2026-10-30', '2026-01-01')).resolves.toMatchObject({
      id: 'second',
      sequence: 2,
    });
    await expect(getSeminarByEventDate(db, '2027-01-01', '2026-01-01')).resolves.toBeNull();
  });
});

describe('mergeMilestones', () => {
  it('merges static organization records with derived seminar views by date', () => {
    const collection = deriveSeminarCollection([post('first', '2025-12-26')], '2025-12-20');
    const mergeMilestones = (
      seminarDomain as {
        mergeMilestones?: (
          organization: Array<{
            date: string;
            title: string;
            location: string;
            description: string;
          }>,
          seminars: SeminarView[],
          today: string,
        ) => Array<{
          kind: string;
          date: string;
          title: string;
          href: string | null;
          status: string;
        }>;
      }
    ).mergeMilestones;

    expect(mergeMilestones).toBeTypeOf('function');
    if (!mergeMilestones) return;

    const result = mergeMilestones(
      [
        {
          date: '2025-12-12',
          title: 'Founding',
          location: 'Seoul',
          description: 'Founded.',
        },
      ],
      collection.chronological,
      '2025-12-20',
    );

    expect(result).toEqual([
      expect.objectContaining({
        kind: 'organization',
        date: '2025-12-12',
        title: 'Founding',
        href: null,
        status: 'held',
      }),
      expect.objectContaining({
        kind: 'seminar',
        date: '2025-12-26',
        title: 'First International Seminar',
        href: '/seminars/2025-12-26',
        status: 'upcoming',
      }),
    ]);
  });
});
