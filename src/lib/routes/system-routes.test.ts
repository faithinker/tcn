import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env, getDB, getSeminarCollection } = vi.hoisted(() => ({
  env: {} as { DB?: unknown; MEDIA?: unknown; SESSION_SECRET?: string },
  getDB: vi.fn(),
  getSeminarCollection: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../db', () => ({ getDB }));
vi.mock('../seminars/service', () => ({ getSeminarCollection }));

import { GET as getHealth } from '../../pages/api/health';
import { GET as getReadiness } from '../../pages/api/ready';
import { GET as getSitemap } from '../../pages/sitemap.xml';

describe('system health routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.DB = {
      prepare: vi.fn(() => ({ first: vi.fn().mockResolvedValue({ ok: 1 }) })),
    };
    env.MEDIA = { head: vi.fn().mockResolvedValue(null) };
    env.SESSION_SECRET = 'test-secret';
  });

  it('provides dependency-free liveness without exposing details', async () => {
    delete env.DB;
    delete env.MEDIA;
    delete env.SESSION_SECRET;

    const response = await getHealth!({} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('checks D1, R2 and the session secret for readiness', async () => {
    const response = await getReadiness!({} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    expect((env.MEDIA as { head: ReturnType<typeof vi.fn> }).head).toHaveBeenCalledWith(
      '__tcn_readiness__',
    );
  });

  it('returns a minimal unavailable response when D1 fails', async () => {
    env.DB = {
      prepare: vi.fn(() => ({ first: vi.fn().mockRejectedValue(new Error('sensitive DB error')) })),
    };

    const response = await getReadiness!({} as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false });
  });

  it.each(['DB', 'MEDIA', 'SESSION_SECRET'] as const)(
    'is unavailable when the %s dependency is missing',
    async (binding) => {
      delete env[binding];

      const response = await getReadiness!({} as never);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ ok: false });
    },
  );
});

describe('GET /sitemap.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDB.mockReturnValue({});
    getSeminarCollection.mockResolvedValue({
      chronological: [{ href: '/seminars/2025-12-26' }],
    });
  });

  it('publishes the same slashless URLs used by canonical metadata', async () => {
    const response = await getSitemap!({
      site: new URL('https://tcn.example'),
    } as never);
    const xml = await response.text();

    expect(xml).toContain('<loc>https://tcn.example/about</loc>');
    expect(xml).toContain('<loc>https://tcn.example/seminars/2025-12-26</loc>');
    expect(xml).not.toContain('<loc>https://tcn.example/about/</loc>');
  });

  it('logs D1 failures before returning the static fallback', async () => {
    const failure = new Error('D1 unavailable');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getSeminarCollection.mockRejectedValue(failure);

    const response = await getSitemap!({
      site: new URL('https://tcn.example'),
    } as never);

    expect(response.status).toBe(200);
    expect(error).toHaveBeenCalledWith('sitemap: failed to load seminar routes', failure);
    error.mockRestore();
  });
});
