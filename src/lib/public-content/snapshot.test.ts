import { describe, expect, it } from 'vitest';
import type { Post } from '../db/types';
import { buildSnapshot } from './core';
import { deriveFromSnapshot, getPublicSeminars, loadPublicSnapshot } from './snapshot';

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

describe('deriveFromSnapshot', () => {
  const posts = [
    post('past', '2025-12-26'),
    post('now', '2026-10-15'),
    post('later', '2026-10-30'),
  ];

  it('derives the seminar states from the snapshot date, not the wall clock', async () => {
    const onTheDay = deriveFromSnapshot(
      await buildSnapshot({ posts, source: 'local', today: '2026-10-15' }),
    );
    expect(onTheDay.chronological.map((s) => [s.id, s.status])).toEqual([
      ['past', 'held'],
      ['now', 'today'],
      ['later', 'upcoming'],
    ]);
    expect(onTheDay.next?.id).toBe('now');
    expect(onTheDay.latestPast?.id).toBe('past');

    const nextDay = deriveFromSnapshot(
      await buildSnapshot({ posts, source: 'local', today: '2026-10-16' }),
    );
    expect(nextDay.next?.id).toBe('later');
    expect(nextDay.latestPast?.id).toBe('now');
  });

  it('yields an empty collection for an empty snapshot', async () => {
    const collection = deriveFromSnapshot(
      await buildSnapshot({ posts: [], source: 'empty', today: '2026-10-15' }),
    );
    expect(collection.chronological).toEqual([]);
    expect(collection.next).toBeNull();
    expect(collection.latestPast).toBeNull();
  });
});

describe('loadPublicSnapshot', () => {
  it('always yields a valid snapshot, empty when no export has run', async () => {
    const snapshot = await loadPublicSnapshot();
    expect(snapshot.schema).toBe(1);
    expect(['remote', 'local', 'empty']).toContain(snapshot.source);
    expect(snapshot.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    if (snapshot.source === 'empty') expect(snapshot.posts).toEqual([]);
  });

  it('derives the collection from the same snapshot it returns', async () => {
    const { snapshot, collection } = await getPublicSeminars();
    expect(collection.chronological).toHaveLength(snapshot.posts.length);
  });
});
