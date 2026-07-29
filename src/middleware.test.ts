import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(handler: T) => handler,
}));

import { onRequest } from './middleware';

function context(path: string, isPrerendered = false) {
  return {
    request: new Request(`https://tcn.example${path}`),
    isPrerendered,
  } as unknown as Parameters<typeof onRequest>[0];
}

function expectResponse(value: void | Response): Response {
  expect(value).toBeInstanceOf(Response);
  if (!(value instanceof Response)) throw new Error('middleware did not return a response');
  return value;
}

describe('site middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects a non-canonical GET before rendering the route', async () => {
    const next = vi.fn();

    const response = expectResponse(await onRequest(context('/about/'), next));

    expect(response.status).toBe(301);
    expect(response.headers.get('location')).toBe('https://tcn.example/about');
    expect(next).not.toHaveBeenCalled();
  });

  it.each(['/questions', '/questions/q-1', '/admin/questions', '/api/questions/q-1'])(
    'adds privacy and embedding headers to %s',
    async (path) => {
      const next = vi.fn().mockResolvedValue(new Response('ok'));

      const response = expectResponse(await onRequest(context(path), next));

      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(response.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    },
  );

  it('leaves unrelated public responses unchanged', async () => {
    const next = vi.fn().mockResolvedValue(new Response('ok'));

    const response = expectResponse(await onRequest(context('/about'), next));

    expect(response.headers.get('cache-control')).toBeNull();
    expect(response.headers.get('content-security-policy')).toBeNull();
  });
});
