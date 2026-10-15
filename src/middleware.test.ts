import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('astro:middleware', () => ({
  defineMiddleware: <T>(handler: T) => handler,
}));

import { onRequest } from './middleware';
import { SECURITY_HEADERS } from './lib/security-headers';

function expectBaseline(response: Response) {
  expect(Object.keys(SECURITY_HEADERS)).not.toHaveLength(0);
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    expect(response.headers.get(name)).toBe(value);
  }
}

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

  it.each(['/about', '/', '/admin', '/api/health'])(
    'adds the baseline security headers to %s without touching its caching',
    async (path) => {
      const next = vi.fn().mockResolvedValue(new Response('ok'));

      const response = expectResponse(await onRequest(context(path), next));

      expectBaseline(response);
      expect(response.headers.get('cache-control')).toBeNull();
    },
  );

  it('returns the rendered response itself so framework-attached state such as cookies survives', async () => {
    const rendered = new Response('ok');
    const next = vi.fn().mockResolvedValue(rendered);

    const response = expectResponse(await onRequest(context('/admin'), next));

    expect(response).toBe(rendered);
  });

  it('adds the baseline to a response whose headers are immutable', async () => {
    const next = vi.fn().mockResolvedValue(Response.redirect('https://tcn.example/admin', 302));

    const response = expectResponse(await onRequest(context('/admin/login'), next));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://tcn.example/admin');
    expectBaseline(response);
  });

  it('adds the baseline to the canonical redirect as well', async () => {
    const next = vi.fn();

    const response = expectResponse(await onRequest(context('/about/'), next));

    expect(response.status).toBe(301);
    expectBaseline(response);
  });
});
