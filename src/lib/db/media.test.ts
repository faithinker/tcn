import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ newId: vi.fn(() => 'new-id') }));

import * as mediaDb from './media';

describe('getPublicMediaByKey', () => {
  it('requires a visible parent post', async () => {
    const media = { id: 'm1', postId: 'p1', r2Key: 'p1/file.webp' };
    const first = vi.fn().mockResolvedValue(media);
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;

    await expect(mediaDb.getPublicMediaByKey(db, 'p1/file.webp')).resolves.toEqual(media);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('join posts p'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('p.deleted_at is null'));
    expect(bind).toHaveBeenCalledWith('p1/file.webp');
  });
});

describe('updateMediaMetadata', () => {
  it('updates caption and position and returns the refreshed media row', async () => {
    const updated = { id: 'm1', caption: 'Seminar discussion', position: 2 };
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const first = vi.fn().mockResolvedValue(updated);
    const bind = vi.fn().mockReturnValueOnce({ run }).mockReturnValueOnce({ first });
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const updateMediaMetadata = (
      mediaDb as {
        updateMediaMetadata?: (
          db: D1Database,
          id: string,
          input: { caption: string | null; position: number },
        ) => Promise<unknown>;
      }
    ).updateMediaMetadata;

    expect(updateMediaMetadata).toBeTypeOf('function');
    if (!updateMediaMetadata) return;

    await expect(
      updateMediaMetadata(db, 'm1', { caption: 'Seminar discussion', position: 2 }),
    ).resolves.toEqual(updated);
    expect(prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('update media set caption = ?2, position = ?3'),
    );
    expect(bind).toHaveBeenNthCalledWith(1, 'm1', 'Seminar discussion', 2);
  });

  it('returns null when the media row does not exist', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const updateMediaMetadata = (
      mediaDb as {
        updateMediaMetadata?: (
          db: D1Database,
          id: string,
          input: { caption: string | null; position: number },
        ) => Promise<unknown>;
      }
    ).updateMediaMetadata;

    expect(updateMediaMetadata).toBeTypeOf('function');
    if (!updateMediaMetadata) return;

    await expect(
      updateMediaMetadata(db, 'missing', { caption: null, position: 0 }),
    ).resolves.toBeNull();
  });
});

describe('deleteMediaAndQueueCleanup', () => {
  it('uses one D1 batch so the cleanup record and media deletion are atomic', async () => {
    const bind = vi.fn(function (this: unknown) {
      return this;
    });
    const prepare = vi.fn(() => ({ bind }));
    const batch = vi.fn().mockResolvedValue([{ meta: { changes: 1 } }, { meta: { changes: 1 } }]);
    const db = { prepare, batch } as unknown as D1Database;

    await expect(mediaDb.deleteMediaAndQueueCleanup(db, 'm1', 'post-1/file.webp')).resolves.toBe(
      true,
    );
    expect(batch).toHaveBeenCalledOnce();
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('media_cleanup_queue'));
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('delete from media'));
  });
});
