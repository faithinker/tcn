import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';

vi.mock('./client', () => ({ newId: () => crypto.randomUUID() }));

import {
  addMedia,
  deleteMediaAndQueueCleanup,
  getMediaById,
  getPublicMediaByKey,
  listMediaCleanupKeys,
  updateMediaMetadata,
} from './media';
import { createPost, softDeletePost } from './posts';

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
  await db().prepare('delete from media_cleanup_queue').run();
});

async function seedMedia(r2Key = 'p1/file.webp') {
  const post = await createPost(db(), { title: 'Seminar' });
  const media = await addMedia(db(), { postId: post.id, r2Key, kind: 'image' });
  return { post, media };
}

describe('getPublicMediaByKey', () => {
  it('serves media of a visible post and hides it once the post is deleted', async () => {
    const { post, media } = await seedMedia();

    await expect(getPublicMediaByKey(db(), 'p1/file.webp')).resolves.toMatchObject({
      id: media.id,
    });

    await softDeletePost(db(), post.id);
    await expect(getPublicMediaByKey(db(), 'p1/file.webp')).resolves.toBeNull();
  });
});

describe('updateMediaMetadata', () => {
  it('updates caption and position and returns the refreshed media row', async () => {
    const { media } = await seedMedia();

    await expect(
      updateMediaMetadata(db(), media.id, { caption: 'Seminar discussion', position: 2 }),
    ).resolves.toMatchObject({ id: media.id, caption: 'Seminar discussion', position: 2 });
  });

  it('returns null when the media row does not exist', async () => {
    await expect(
      updateMediaMetadata(db(), 'missing', { caption: null, position: 0 }),
    ).resolves.toBeNull();
  });
});

describe('deleteMediaAndQueueCleanup', () => {
  it('removes the row and queues its R2 key for cleanup', async () => {
    const { media } = await seedMedia();

    await expect(deleteMediaAndQueueCleanup(db(), media.id, 'p1/file.webp')).resolves.toBe(true);

    await expect(getMediaById(db(), media.id)).resolves.toBeNull();
    await expect(listMediaCleanupKeys(db())).resolves.toEqual(['p1/file.webp']);
  });

  it('queues nothing for a row that is already gone', async () => {
    await expect(deleteMediaAndQueueCleanup(db(), 'missing', 'p1/file.webp')).resolves.toBe(false);

    await expect(listMediaCleanupKeys(db())).resolves.toEqual([]);
  });
});
