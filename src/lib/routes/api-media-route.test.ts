import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  bucket,
  completeMediaCleanup,
  deleteMediaAndQueueCleanup,
  getBucket,
  getMediaById,
  getSessionSecret,
  getSessionUser,
  getDB,
  recordMediaCleanupFailure,
  updateMediaMetadata,
} = vi.hoisted(() => ({
  bucket: { delete: vi.fn() },
  completeMediaCleanup: vi.fn(),
  deleteMediaAndQueueCleanup: vi.fn(),
  getBucket: vi.fn(),
  getMediaById: vi.fn(),
  getSessionSecret: vi.fn(() => 'test-secret'),
  getSessionUser: vi.fn(),
  getDB: vi.fn(() => ({})),
  recordMediaCleanupFailure: vi.fn(),
  updateMediaMetadata: vi.fn(),
}));

vi.mock('../auth/guard', () => ({
  getSessionUid: vi.fn(),
  getSessionSecret,
  getSessionUser,
}));
vi.mock('../db', () => ({
  completeMediaCleanup,
  deleteMediaAndQueueCleanup,
  getBucket,
  getDB,
  getMediaById,
  recordMediaCleanupFailure,
  updateMediaMetadata,
}));

import { createCsrfToken } from '../auth/mutation';
import * as mediaRoute from '../../pages/api/media/[id]';

const OFFICER = {
  id: 'user-1',
  username: 'editor',
  displayName: 'Editor',
  role: 'officer',
  status: 'approved',
  isExecutive: false,
} as const;
const MEMBER = { ...OFFICER, id: 'member-1', role: 'member' } as const;
let csrfToken = '';

function context(body: unknown, id = 'm1', headers: HeadersInit = {}) {
  return {
    request: new Request(`http://localhost/api/media/${id}`, {
      method: 'PATCH',
      headers: {
        origin: 'http://localhost',
        cookie: 'tcn_session=test-session',
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    }),
    params: { id },
  } as unknown as Parameters<NonNullable<typeof mediaRoute.PATCH>>[0];
}

function deleteContext(id = 'm1', headers: HeadersInit = {}) {
  return {
    request: new Request(`http://localhost/api/media/${id}`, {
      method: 'DELETE',
      headers: {
        origin: 'http://localhost',
        cookie: 'tcn_session=test-session',
        'x-csrf-token': csrfToken,
        ...headers,
      },
    }),
    params: { id },
  } as unknown as Parameters<NonNullable<typeof mediaRoute.DELETE>>[0];
}

describe('PATCH /api/media/[id]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    csrfToken = await createCsrfToken('posts', 'test-session', 'test-secret');
    getSessionUser.mockResolvedValue(OFFICER);
  });

  it('answers 401 without a session and 403 to a non-officer or missing CSRF before touching D1 or R2', async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await mediaRoute.PATCH!(context({ caption: 'x' }))).status).toBe(401);

    getSessionUser.mockResolvedValue(OFFICER);
    expect(
      (await mediaRoute.PATCH!(context({ caption: 'x' }, 'm1', { 'x-csrf-token': '' }))).status,
    ).toBe(403);

    getSessionUser.mockResolvedValue(MEMBER);
    const response = await mediaRoute.PATCH!(context({ caption: 'x' }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(updateMediaMetadata).not.toHaveBeenCalled();
  });

  it('updates an optional caption and gallery position for an authenticated editor', async () => {
    const media = { id: 'm1', caption: 'Seminar discussion', position: 2 };
    updateMediaMetadata.mockResolvedValue(media);
    const patch = mediaRoute.PATCH;

    expect(patch).toBeTypeOf('function');
    if (!patch) return;

    const response = await patch(context({ caption: '  Seminar discussion  ', position: 2 }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, media });
    expect(updateMediaMetadata).toHaveBeenCalledWith(expect.anything(), 'm1', {
      caption: 'Seminar discussion',
      position: 2,
    });
  });

  it('rejects invalid metadata without writing to D1', async () => {
    const patch = mediaRoute.PATCH;

    expect(patch).toBeTypeOf('function');
    if (!patch) return;

    const response = await patch(context({ caption: null, position: -1 }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'position_invalid' });
    expect(updateMediaMetadata).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/media/[id]', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    csrfToken = await createCsrfToken('posts', 'test-session', 'test-secret');
    getSessionUser.mockResolvedValue(OFFICER);
    getBucket.mockReturnValue(bucket);
    getMediaById.mockResolvedValue({ id: 'm1', r2Key: 'post-1/file.webp' });
    deleteMediaAndQueueCleanup.mockResolvedValue(true);
    completeMediaCleanup.mockResolvedValue(undefined);
    recordMediaCleanupFailure.mockResolvedValue(undefined);
    bucket.delete.mockResolvedValue(undefined);
  });

  it('answers 401 without a session and 403 to a non-officer or missing CSRF before touching D1 or R2', async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await mediaRoute.DELETE!(deleteContext())).status).toBe(401);

    getSessionUser.mockResolvedValue(OFFICER);
    expect((await mediaRoute.DELETE!(deleteContext('m1', { 'x-csrf-token': '' }))).status).toBe(
      403,
    );

    getSessionUser.mockResolvedValue(MEMBER);
    const response = await mediaRoute.DELETE!(deleteContext());
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(deleteMediaAndQueueCleanup).not.toHaveBeenCalled();
    expect(bucket.delete).not.toHaveBeenCalled();
  });

  it('queues cleanup atomically before removing the R2 object', async () => {
    const response = await mediaRoute.DELETE!(deleteContext());

    expect(response.status).toBe(200);
    expect(deleteMediaAndQueueCleanup).toHaveBeenCalledWith(
      expect.anything(),
      'm1',
      'post-1/file.webp',
    );
    expect(bucket.delete).toHaveBeenCalledWith('post-1/file.webp');
    expect(completeMediaCleanup).toHaveBeenCalledWith(expect.anything(), 'post-1/file.webp');
  });

  it('keeps a retry record when R2 deletion fails', async () => {
    bucket.delete.mockRejectedValue(new Error('R2 unavailable'));

    const response = await mediaRoute.DELETE!(deleteContext());

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true, cleanupPending: true });
    expect(recordMediaCleanupFailure).toHaveBeenCalledWith(
      expect.anything(),
      'post-1/file.webp',
      'R2 unavailable',
    );
    expect(completeMediaCleanup).not.toHaveBeenCalled();
  });
});
