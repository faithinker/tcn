import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import astroConfig from '../../astro.config.mjs';
import { canonicalPath, canonicalRedirectTarget } from './canonical-url';

function redirectRules(): Map<string, { destination: string; status: number }> {
  const source = readFileSync(new URL('../../public/_redirects', import.meta.url), 'utf8');
  const rules = new Map<string, { destination: string; status: number }>();

  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [path, destination, rawStatus] = trimmed.split(/\s+/);
    if (path && destination && rawStatus) {
      rules.set(path, { destination, status: Number(rawStatus) });
    }
  }

  return rules;
}

describe('canonicalPath', () => {
  it('builds slashless static routes as HTML files instead of redirecting index pages', () => {
    expect(astroConfig.build?.format).toBe('file');
  });

  it('uses one slashless canonical form for every non-root page', () => {
    expect(canonicalPath('/')).toBe('/');
    expect(canonicalPath('/about')).toBe('/about');
    expect(canonicalPath('/about/')).toBe('/about');
    expect(canonicalPath('/seminars/2025-12-26/')).toBe('/seminars/2025-12-26');
  });

  it.each([
    ['GET', 'https://tcn.example/about/?ref=legacy', 'https://tcn.example/about?ref=legacy'],
    ['HEAD', 'https://tcn.example/seminars/2025-12-26/', 'https://tcn.example/seminars/2025-12-26'],
  ])('redirects %s page requests to the canonical URL', (method, source, destination) => {
    expect(canonicalRedirectTarget(new Request(source, { method }))?.href).toBe(destination);
  });

  it('does not turn prerendered pages into redirect documents during the build', () => {
    expect(
      canonicalRedirectTarget(
        new Request('https://tcn.faithinker12.workers.dev/about/founding/'),
        true,
      ),
    ).toBeNull();
  });

  it.each([
    ['GET', 'https://tcn.example/'],
    ['POST', 'https://tcn.example/about/'],
    ['GET', 'https://tcn.example/api/posts/'],
    ['GET', 'https://tcn.example/media/post/video.mp4/'],
    ['GET', 'https://tcn.example/favicon.svg/'],
  ])('does not redirect excluded request %s %s', (method, source) => {
    expect(canonicalRedirectTarget(new Request(source, { method }))).toBeNull();
  });
});

describe('legacy redirects', () => {
  const firstSeminar = '/seminars/2025-12-26';
  const secondSeminar = '/seminars/2026-10-30';

  it.each([
    ['/seminars/2025-laos', firstSeminar],
    ['/seminars/2025-laos/', firstSeminar],
    ['/ko/seminars/2025-laos', firstSeminar],
    ['/ko/seminars/2025-laos/', firstSeminar],
    ['/en/seminars/2025-laos', firstSeminar],
    ['/en/seminars/2025-laos/', firstSeminar],
    ['/seminars/2026-korea', secondSeminar],
    ['/seminars/2026-korea/', secondSeminar],
    ['/ko/seminars/2026-korea', secondSeminar],
    ['/ko/seminars/2026-korea/', secondSeminar],
    ['/en/seminars/2026-korea', secondSeminar],
    ['/en/seminars/2026-korea/', secondSeminar],
    ['/ko/seminars/1', firstSeminar],
    ['/ko/seminars/1/', firstSeminar],
    ['/en/seminars/1', firstSeminar],
    ['/en/seminars/1/', firstSeminar],
    ['/ko/seminars/2', secondSeminar],
    ['/ko/seminars/2/', secondSeminar],
    ['/en/seminars/2', secondSeminar],
    ['/en/seminars/2/', secondSeminar],
  ])('redirects %s directly to its canonical seminar URL', (source, destination) => {
    expect(redirectRules().get(source)).toEqual({ destination, status: 301 });
  });

  it.each([
    '/events/2025/founding-ceremony-invitation',
    '/events/2025/founding-ceremony-invitation/',
    '/en/events/2025/founding-ceremony-invitation',
    '/en/events/2025/founding-ceremony-invitation/',
  ])('keeps the founding invitation at the founding record: %s', (source) => {
    expect(redirectRules().get(source)).toEqual({
      destination: '/about/founding',
      status: 301,
    });
  });

  it.each([
    '/about/',
    '/about/founding/',
    '/about/declaration/',
    '/about/bylaws/',
    '/people/',
    '/seminars/',
    '/contact/',
    '/admin/',
    '/admin/login/',
  ])('leaves canonical trailing-slash handling outside _redirects: %s', (source) => {
    expect(redirectRules().get(source)).toBeUndefined();
  });
});
