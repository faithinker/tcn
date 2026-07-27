import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UPLOAD_LIMITS } from '../media/validate';

const { addMedia, bucket, getBucket, getDB, getPost, getSessionUid, newId } = vi.hoisted(() => ({
  addMedia: vi.fn(),
  bucket: { put: vi.fn(), delete: vi.fn() },
  getBucket: vi.fn(),
  getDB: vi.fn(() => ({})),
  getPost: vi.fn(),
  getSessionUid: vi.fn(),
  newId: vi.fn(() => 'media-id'),
}));

vi.mock('../auth', () => ({ getSessionUid }));
vi.mock('../db', () => ({ addMedia, getBucket, getDB, getPost, newId }));

import { POST } from '../../pages/api/media/index';

function context({
  mime = 'video/mp4',
  size = 3,
  filename = 'seminar.mp4',
  includeLength = true,
}: {
  mime?: string;
  size?: number;
  filename?: string;
  includeLength?: boolean;
} = {}) {
  const url = new URL('http://localhost/api/media');
  url.searchParams.set('postId', 'post-1');
  url.searchParams.set('position', '2');
  url.searchParams.set('filename', filename);
  const headers = new Headers({ 'content-type': mime });
  if (includeLength) headers.set('content-length', String(size));
  const request = new Request(url, {
    method: 'POST',
    headers,
    body: new Uint8Array([1, 2, 3]),
  });
  return { request } as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('POST /api/media', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('user-1');
    getBucket.mockReturnValue(bucket);
    getPost.mockResolvedValue({ id: 'post-1' });
    bucket.put.mockResolvedValue({});
    bucket.delete.mockResolvedValue(undefined);
    addMedia.mockResolvedValue({
      id: 'media-id',
      postId: 'post-1',
      r2Key: 'post-1/media-id.mp4',
      kind: 'video',
    });
  });

  it('streams non-image request bodies to R2 before recording metadata', async () => {
    const response = await POST!(context());

    expect(response.status).toBe(200);
    expect(bucket.put).toHaveBeenCalledWith('post-1/media-id.mp4', expect.any(ReadableStream), {
      httpMetadata: { contentType: 'video/mp4' },
    });
    expect(addMedia).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        postId: 'post-1',
        size: 3,
        filename: 'seminar.mp4',
        position: 2,
      }),
    );
  });

  it('requires a trustworthy declared size before consuming the body', async () => {
    const response = await POST!(context({ includeLength: false }));

    expect(response.status).toBe(411);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'content_length_required' });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('rejects oversized videos before consuming the body', async () => {
    const response = await POST!(context({ size: UPLOAD_LIMITS.video + 1 }));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'video_too_large' });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('removes an R2 object when the D1 insert fails', async () => {
    addMedia.mockRejectedValue(new Error('D1 unavailable'));

    await expect(POST!(context())).rejects.toThrow('D1 unavailable');
    expect(bucket.delete).toHaveBeenCalledWith('post-1/media-id.mp4');
  });
});
