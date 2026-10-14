import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bucket,
  completeMediaCleanup,
  getBucket,
  getDB,
  getSessionUser,
  listMediaCleanupKeys,
  recordMediaCleanupFailure,
} = vi.hoisted(() => ({
  bucket: { delete: vi.fn() },
  completeMediaCleanup: vi.fn(),
  getBucket: vi.fn(),
  getDB: vi.fn(() => ({})),
  getSessionUser: vi.fn(),
  listMediaCleanupKeys: vi.fn(),
  recordMediaCleanupFailure: vi.fn(),
}));

vi.mock('../auth/guard', () => ({
  getSessionUid: vi.fn(),
  getSessionSecret: vi.fn(),
  getSessionUser,
}));
vi.mock('../db', () => ({
  completeMediaCleanup,
  getBucket,
  getDB,
  listMediaCleanupKeys,
  recordMediaCleanupFailure,
}));

import { POST } from '../../pages/api/maintenance/media-cleanup';

const OFFICER = {
  id: 'user-1',
  username: 'editor',
  displayName: 'Editor',
  role: 'officer',
  status: 'approved',
  isExecutive: false,
} as const;
const MEMBER = { ...OFFICER, id: 'member-1', role: 'member' } as const;

describe('POST /api/maintenance/media-cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUser.mockResolvedValue(OFFICER);
    getBucket.mockReturnValue(bucket);
    listMediaCleanupKeys.mockResolvedValue(['a.webp', 'b.webp']);
    bucket.delete.mockResolvedValue(undefined);
    completeMediaCleanup.mockResolvedValue(undefined);
    recordMediaCleanupFailure.mockResolvedValue(undefined);
  });

  it('answers 401 without a session and 403 to a non-officer before listing cleanup keys', async () => {
    const request = () =>
      ({
        request: new Request('http://localhost/api/maintenance/media-cleanup', { method: 'POST' }),
      }) as never;

    getSessionUser.mockResolvedValue(null);
    expect((await POST!(request())).status).toBe(401);

    getSessionUser.mockResolvedValue(MEMBER);
    expect((await POST!(request())).status).toBe(403);
    expect(listMediaCleanupKeys).not.toHaveBeenCalled();
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
