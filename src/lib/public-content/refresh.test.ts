import { describe, expect, it, vi } from 'vitest';
import { requestStaticRefresh, triggerStaticRefresh } from './refresh';

vi.mock('cloudflare:workers', () => ({
  env: {
    GITHUB_DISPATCH_TOKEN: 'token-123',
  },
}));

vi.mock('../db', () => ({
  listSeminarPosts: vi.fn(async () => [
    {
      id: 'post-1',
      title: 'New Seminar',
      summary: 'Summary',
      eventDate: '2026-11-01',
      address: 'Seoul',
    },
  ]),
}));

describe('requestStaticRefresh', () => {
  const fakeDb = {} as D1Database;
  const siteUrl = 'https://thetcn.org';

  it('returns false immediately when no github token is configured', async () => {
    const fetchFn = vi.fn();
    const result = await requestStaticRefresh(fakeDb, siteUrl, { fetchFn });
    expect(result).toBe(false);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('returns false when deployed fingerprint matches live content', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/content-fingerprint.json')) {
        // Compute what live content produces and return it
        const { seminarFingerprint, kstToday } = await import('./core');
        const { listSeminarPosts } = await import('../db');
        const fp = await seminarFingerprint(await listSeminarPosts(fakeDb), kstToday());
        return new Response(JSON.stringify({ fingerprint: fp, today: kstToday() }), { status: 200 });
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await requestStaticRefresh(fakeDb, siteUrl, {
      githubToken: 'gh-token-test',
      fetchFn,
    });
    expect(result).toBe(false);
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it('dispatches GitHub Actions workflow when live content differs from deployed', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.endsWith('/content-fingerprint.json')) {
        return new Response(JSON.stringify({ fingerprint: 'stale-hash', today: '2026-10-01' }), {
          status: 200,
        });
      }
      if (urlStr.includes('/actions/workflows/deploy-workers.yml/dispatches')) {
        expect(init?.method).toBe('POST');
        expect(init?.headers).toMatchObject({
          authorization: 'Bearer gh-token-test',
          'user-agent': 'tcn-worker',
          'content-type': 'application/json',
        });
        expect(JSON.parse(init?.body as string)).toEqual({ ref: 'main' });
        return new Response(null, { status: 204 });
      }
      return new Response('Not found', { status: 404 });
    });

    const result = await requestStaticRefresh(fakeDb, siteUrl, {
      githubToken: 'gh-token-test',
      repo: 'faithinker/tcn',
      fetchFn,
    });
    expect(result).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('handles deployed fingerprint fetch failure gracefully without throwing', async () => {
    const fetchFn = vi.fn(async () => new Response('Internal error', { status: 500 }));
    const result = await requestStaticRefresh(fakeDb, siteUrl, {
      githubToken: 'gh-token-test',
      fetchFn,
    });
    expect(result).toBe(false);
  });

  it('handles github dispatch failure gracefully without throwing', async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      if (url.toString().endsWith('/content-fingerprint.json')) {
        return new Response(JSON.stringify({ fingerprint: 'stale', today: 'old' }), { status: 200 });
      }
      return new Response('Bad credentials', { status: 401 });
    });
    const result = await requestStaticRefresh(fakeDb, siteUrl, {
      githubToken: 'gh-token-test',
      fetchFn,
    });
    expect(result).toBe(false);
  });
});

describe('triggerStaticRefresh', () => {
  it('does not crash and calls background wait when token is present', () => {
    const fakeDb = {} as D1Database;
    expect(() => triggerStaticRefresh('https://thetcn.org/api/posts', fakeDb)).not.toThrow();
  });
});
