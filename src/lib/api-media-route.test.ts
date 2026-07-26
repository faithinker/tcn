import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUid, getDB, updateMediaMetadata } = vi.hoisted(() => ({
  getSessionUid: vi.fn(),
  getDB: vi.fn(() => ({})),
  updateMediaMetadata: vi.fn(),
}));

vi.mock('./auth', () => ({ getSessionUid }));
vi.mock('./db', () => ({
  deleteMedia: vi.fn(),
  getBucket: vi.fn(),
  getDB,
  getMediaById: vi.fn(),
  updateMediaMetadata,
}));

import * as mediaRoute from '../pages/api/media/[id]';

function context(body: unknown, id = 'm1') {
  return {
    request: new Request(`http://localhost/api/media/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { id },
  } as unknown as Parameters<NonNullable<typeof mediaRoute.PATCH>>[0];
}

describe('PATCH /api/media/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('user-1');
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
