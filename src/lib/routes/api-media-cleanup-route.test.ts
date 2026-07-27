import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bucket,
  completeMediaCleanup,
  getBucket,
  getDB,
  getSessionUid,
  listMediaCleanupKeys,
  recordMediaCleanupFailure,
} = vi.hoisted(() => ({
  bucket: { delete: vi.fn() },
  completeMediaCleanup: vi.fn(),
  getBucket: vi.fn(),
  getDB: vi.fn(() => ({})),
  getSessionUid: vi.fn(),
  listMediaCleanupKeys: vi.fn(),
  recordMediaCleanupFailure: vi.fn(),
}));

vi.mock('../auth', () => ({ getSessionUid }));
vi.mock('../db', () => ({
  completeMediaCleanup,
  getBucket,
  getDB,
  listMediaCleanupKeys,
  recordMediaCleanupFailure,
}));

import { POST } from '../../pages/api/maintenance/media-cleanup';

describe('POST /api/maintenance/media-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('user-1');
    getBucket.mockReturnValue(bucket);
    listMediaCleanupKeys.mockResolvedValue(['a.webp', 'b.webp']);
    bucket.delete.mockResolvedValue(undefined);
    completeMediaCleanup.mockResolvedValue(undefined);
    recordMediaCleanupFailure.mockResolvedValue(undefined);
  });

  it('reconciles queued R2 objects and clears successful jobs', async () => {
    const response = await POST!({
      request: new Request('http://localhost/api/maintenance/media-cleanup', { method: 'POST' }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      attempted: 2,
      completed: 2,
      failed: 0,
    });
    expect(bucket.delete).toHaveBeenCalledTimes(2);
    expect(completeMediaCleanup).toHaveBeenCalledTimes(2);
  });

  it('retains failed jobs for a later retry', async () => {
    bucket.delete.mockRejectedValueOnce(new Error('R2 unavailable'));

    const response = await POST!({
      request: new Request('http://localhost/api/maintenance/media-cleanup', { method: 'POST' }),
    } as never);

    await expect(response.json()).resolves.toEqual({
      ok: true,
      attempted: 2,
      completed: 1,
      failed: 1,
    });
    expect(recordMediaCleanupFailure).toHaveBeenCalledWith(
      expect.anything(),
      'a.webp',
      'R2 unavailable',
    );
  });
});
