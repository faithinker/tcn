import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAssets, getBucket, getDB, getPublicMediaByKey, get, head } = vi.hoisted(() => ({
  getAssets: vi.fn(),
  getBucket: vi.fn(),
  getDB: vi.fn(() => ({})),
  getPublicMediaByKey: vi.fn(),
  get: vi.fn(),
  head: vi.fn(),
}));

vi.mock('./db', () => ({ getAssets, getBucket, getDB, getPublicMediaByKey }));

import * as mediaRoute from '../pages/media/[...key]';

const key = 'post-1/video.mp4';

function context(
  method: 'GET' | 'HEAD',
  headers?: HeadersInit,
  requestKey = key,
) {
  return {
    request: new Request(`http://localhost/media/${requestKey}`, { method, headers }),
    params: { key: requestKey },
  } as unknown as Parameters<NonNullable<typeof mediaRoute.GET>>[0];
}

function object(overrides: Record<string, unknown> = {}) {
  return {
    body: new Uint8Array([1, 2, 3]),
    httpEtag: '"etag"',
    size: 1_000,
    writeHttpMetadata: (headers: Headers) => headers.set('content-type', 'video/mp4'),
    ...overrides,
  };
}

describe('/media/[...key]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBucket.mockReturnValue({ get, head });
    getPublicMediaByKey.mockResolvedValue({ id: 'media-1', r2Key: key });
  });

  it('passes byte ranges to R2 and returns a partial-content response', async () => {
    get.mockResolvedValue(object({ range: { offset: 100, length: 200 } }));
    const requestContext = context('GET', { range: 'bytes=100-299' });

    const response = await mediaRoute.GET!(requestContext);

    expect(get).toHaveBeenCalledWith(key, {
      onlyIf: requestContext.request.headers,
      range: requestContext.request.headers,
    });
    expect(response.status).toBe(206);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-range')).toBe('bytes 100-299/1000');
    expect(response.headers.get('content-length')).toBe('200');
    expect(response.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
  });

  it('normalizes founding-film ranges when the local asset binding returns a full response', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { 'content-type': 'video/mp4', etag: '"asset-etag"' },
      }),
    );
    getAssets.mockReturnValue({ fetch });

    const response = await mediaRoute.GET!(
      context('GET', { range: 'bytes=1-2' }, 'founding/founding-ceremony'),
    );

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 1-2/4');
    expect(response.headers.get('content-length')).toBe('2');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([2, 3]);
    expect(getPublicMediaByKey).not.toHaveBeenCalled();
  });

  it('serves HEAD metadata for the static founding film without querying D1', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        headers: { 'content-type': 'video/mp4', 'content-length': '4' },
      }),
    );
    getAssets.mockReturnValue({ fetch });

    const response = await mediaRoute.HEAD!(
      context('HEAD', undefined, 'founding/founding-ceremony'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.body).toBeNull();
    expect(getPublicMediaByKey).not.toHaveBeenCalled();
  });

  it('supports metadata-only HEAD requests', async () => {
    head.mockResolvedValue(object());

    expect(mediaRoute.HEAD).toBeTypeOf('function');
    const response = await mediaRoute.HEAD!(context('HEAD'));

    expect(head).toHaveBeenCalledWith(key);
    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('content-length')).toBe('1000');
  });

  it('returns suffix ranges using the object size', async () => {
    get.mockResolvedValue(object({ range: { suffix: 125 } }));

    const response = await mediaRoute.GET!(context('GET', { range: 'bytes=-125' }));

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 875-999/1000');
    expect(response.headers.get('content-length')).toBe('125');
  });

  it.each(['items=0-10', 'bytes=', 'bytes=10-5', 'bytes=0-1,4-5'])(
    'rejects unsupported range syntax: %s',
    async (range) => {
      const response = await mediaRoute.GET!(context('GET', { range }));

      expect(response.status).toBe(416);
      expect(response.headers.get('accept-ranges')).toBe('bytes');
      expect(get).not.toHaveBeenCalled();
    },
  );

  it('returns 416 when R2 cannot satisfy a syntactically valid range', async () => {
    get.mockResolvedValue(object());

    const response = await mediaRoute.GET!(context('GET', { range: 'bytes=1000-' }));

    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */1000');
    expect(response.body).toBeNull();
  });

  it('returns conditional responses without a body', async () => {
    const { body: _body, ...metadata } = object();
    get.mockResolvedValue(metadata);
    const requestContext = context('GET', { 'if-none-match': '"etag"' });

    const response = await mediaRoute.GET!(requestContext);

    expect(response.status).toBe(304);
    expect(response.body).toBeNull();
  });

  it('returns 404 for missing objects', async () => {
    get.mockResolvedValue(null);

    const response = await mediaRoute.GET!(context('GET'));

    expect(response.status).toBe(404);
  });

  it('does not serve media whose post is missing or soft-deleted', async () => {
    getPublicMediaByKey.mockResolvedValue(null);

    const response = await mediaRoute.GET!(context('GET'));

    expect(response.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });
});
