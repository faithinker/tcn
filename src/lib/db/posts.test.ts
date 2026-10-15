import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';

vi.mock('./client', () => ({ newId: () => crypto.randomUUID() }));

import {
  createPost,
  getPostByEventDate,
  listSeminarPosts,
  PostRevisionConflictError,
  softDeletePost,
  updatePost,
} from './posts';

let harness: TestD1;
const db = () => harness.db;

beforeAll(async () => {
  harness = await openTestD1();
});
afterAll(async () => {
  await harness.dispose();
});
afterEach(async () => {
  await db().prepare('delete from posts').run();
});

describe('getPostByEventDate', () => {
  it('finds the visible post of a date and ignores a soft-deleted one', async () => {
    const hidden = await createPost(db(), { title: 'Hidden', eventDate: '2025-12-26' });
    await softDeletePost(db(), hidden.id);
    const visible = await createPost(db(), { title: 'Visible', eventDate: '2025-12-26' });

    await expect(getPostByEventDate(db(), '2025-12-26')).resolves.toMatchObject({
      id: visible.id,
    });
    await expect(getPostByEventDate(db(), '2025-01-01')).resolves.toBeNull();
  });
});

describe('listSeminarPosts', () => {
  it('returns only visible dated posts in chronological order', async () => {
    await createPost(db(), { title: 'Later', eventDate: '2026-10-30' });
    await createPost(db(), { title: 'Undated' });
    const removed = await createPost(db(), { title: 'Removed', eventDate: '2026-01-01' });
    await softDeletePost(db(), removed.id);
    await createPost(db(), { title: 'Earlier', eventDate: '2025-12-26' });

    const posts = await listSeminarPosts(db());

    expect(posts.map((post) => post.title)).toEqual(['Earlier', 'Later']);
  });
});

describe('updatePost', () => {
  it('saves the form and bumps the revision', async () => {
    const created = await createPost(db(), { title: 'Draft', eventDate: '2025-12-26' });

    const updated = await updatePost(db(), created.id, {
      title: 'Updated',
      eventDate: '2025-12-26',
      expectedRevision: created.revision,
    });

    expect(updated).toMatchObject({ title: 'Updated', revision: created.revision + 1 });
  });

  it('refuses a save made against a stale revision', async () => {
    const created = await createPost(db(), { title: 'Draft' });
    await updatePost(db(), created.id, { title: 'First', expectedRevision: created.revision });

    await expect(
      updatePost(db(), created.id, { title: 'Second', expectedRevision: created.revision }),
    ).rejects.toBeInstanceOf(PostRevisionConflictError);
  });

  it('returns null for a post that does not exist or was deleted', async () => {
    await expect(
      updatePost(db(), 'missing', { title: 'Nothing', expectedRevision: 1 }),
    ).resolves.toBeNull();

    const created = await createPost(db(), { title: 'Gone' });
    await softDeletePost(db(), created.id);
    await expect(
      updatePost(db(), created.id, { title: 'Late', expectedRevision: created.revision }),
    ).resolves.toBeNull();
  });
});
