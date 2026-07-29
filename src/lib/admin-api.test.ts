import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestJson, safeAdminReturnTo } from './admin-api';

describe('safeAdminReturnTo', () => {
  it.each([
    ['/admin/questions', '/admin/questions'],
    ['/admin/questions/q-1?status=waiting', '/admin/questions/q-1?status=waiting'],
    ['/admin/posts/new', '/admin/posts/new'],
  ])('allows local administrator destinations', (input, expected) => {
    expect(safeAdminReturnTo(input)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['https://evil.example/admin'],
    ['//evil.example/admin'],
    ['/questions'],
    ['/administrator'],
    ['/administer/questions'],
    ['/admin\\@evil.example'],
  ])('rejects unsafe destination %j', (input) => {
    expect(safeAdminReturnTo(input)).toBe('/admin');
  });
});

describe('requestJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a successful JSON payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true, value: 3 })));

    await expect(requestJson<{ ok: true; value: number }>('/api/example')).resolves.toEqual({
      ok: true,
      value: 3,
    });
  });

  it('turns a rejected fetch into a recoverable network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(requestJson('/api/example')).rejects.toMatchObject({
      name: 'ApiRequestError',
      code: 'network_error',
      status: 0,
    });
  });

  it('handles non-JSON server failures without throwing a JSON parse error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<h1>Bad gateway</h1>', { status: 502 })),
    );

    await expect(requestJson('/api/example')).rejects.toEqual(
      expect.objectContaining({
        code: 'invalid_response',
        status: 502,
      }),
    );
  });

  it('preserves an API error code and status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ ok: false, error: 'unauthorized' }, { status: 401 })),
    );

    await expect(requestJson('/api/example')).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
  });
});
