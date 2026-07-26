import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ newId: vi.fn(() => 'new-id') }));

import * as postsDb from './posts';

describe('getPostByEventDate', () => {
  it('looks up a visible post by its event date', async () => {
    const post = { id: 'p1', eventDate: '2025-12-26' };
    const first = vi.fn().mockResolvedValue(post);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const getPostByEventDate = (
      postsDb as { getPostByEventDate?: (db: D1Database, eventDate: string) => Promise<unknown> }
    ).getPostByEventDate;

    expect(getPostByEventDate).toBeTypeOf('function');
    if (!getPostByEventDate) return;

    await expect(getPostByEventDate(db, '2025-12-26')).resolves.toEqual(post);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('event_date = ?1 and deleted_at is null'));
    expect(bind).toHaveBeenCalledWith('2025-12-26');
  });
});

describe('listSeminarPosts', () => {
  it('returns only visible dated posts in chronological order', async () => {
    const posts = [{ id: 'p1', eventDate: '2025-12-26' }];
    const all = vi.fn().mockResolvedValue({ results: posts });
    const prepare = vi.fn(() => ({ all }));
    const db = { prepare } as unknown as D1Database;
    const listSeminarPosts = (
      postsDb as { listSeminarPosts?: (db: D1Database) => Promise<unknown> }
    ).listSeminarPosts;

    expect(listSeminarPosts).toBeTypeOf('function');
    if (!listSeminarPosts) return;

    await expect(listSeminarPosts(db)).resolves.toEqual(posts);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('event_date is not null'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('deleted_at is null'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('order by event_date asc'));
  });
});

describe('updatePost', () => {
  it('uses optimistic concurrency and increments the revision', async () => {
    const updated = { id: 'p1', revision: 4 };
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const first = vi.fn().mockResolvedValue(updated);
    const bind = vi.fn().mockReturnValueOnce({ run }).mockReturnValueOnce({ first });
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;

    await expect(
      postsDb.updatePost(
        db,
        'p1',
        {
          title: 'Updated',
          eventDate: '2025-12-26',
          expectedRevision: 3,
        },
      ),
    ).resolves.toEqual(updated);
    expect(prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('revision = revision + 1'),
    );
    expect(prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('revision = ?8'),
    );
    expect(bind).toHaveBeenNthCalledWith(
      1,
      'p1',
      'Updated',
      null,
      '2025-12-26',
      null,
      '',
      null,
      3,
    );
  });
});
