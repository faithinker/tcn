import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SECURITY_HEADERS, applySecurityHeaders } from './security-headers';

const TURNSTILE = 'https://challenges.cloudflare.com';

function directive(policy: string, name: string): string[] {
  const found = policy
    .split(';')
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
  return found ? found.split(/\s+/).slice(1) : [];
}

function headersRule(file: string, path: string): Record<string, string> {
  const rule: Record<string, string> = {};
  let inRule = false;
  for (const line of file.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      inRule = line.trim() === path;
      continue;
    }
    if (!inRule) continue;
    const separator = line.indexOf(':');
    rule[line.slice(0, separator).trim().toLowerCase()] = line.slice(separator + 1).trim();
  }
  return rule;
}

describe('security header policy', () => {
  it('declares the baseline every response must carry', () => {
    expect(Object.keys(SECURITY_HEADERS).sort()).toEqual([
      'Content-Security-Policy',
      'Content-Security-Policy-Report-Only',
      'Permissions-Policy',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ]);
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('only enforces CSP directives that cannot break page scripts or styles', () => {
    const enforced = SECURITY_HEADERS['Content-Security-Policy'] ?? '';

    expect(directive(enforced, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(enforced, 'base-uri')).toEqual(["'self'"]);
    expect(directive(enforced, 'object-src')).toEqual(["'none'"]);
    expect(directive(enforced, 'script-src')).toEqual([]);
    expect(directive(enforced, 'default-src')).toEqual([]);
  });

  it('observes the full CSP in report-only mode and allows only the Turnstile origin', () => {
    const observed = SECURITY_HEADERS['Content-Security-Policy-Report-Only'] ?? '';

    expect(directive(observed, 'default-src')).toEqual(["'self'"]);
    expect(directive(observed, 'script-src')).toContain(TURNSTILE);
    expect(directive(observed, 'frame-src')).toEqual([TURNSTILE]);
    expect(directive(observed, 'connect-src')).toContain(TURNSTILE);
    expect(directive(observed, 'object-src')).toEqual(["'none'"]);
    expect(directive(observed, 'frame-ancestors')).toEqual(["'none'"]);
    expect(observed).not.toMatch(/(^|\s)\*(\s|;|$)/);
  });

  it('turns off powerful browser features the site never uses', () => {
    const policy = SECURITY_HEADERS['Permissions-Policy'] ?? '';

    for (const feature of ['camera', 'microphone', 'geolocation']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('sets a one-year HSTS without subdomain or preload commitments', () => {
    const hsts = SECURITY_HEADERS['Strict-Transport-Security'] ?? '';

    expect(hsts).toBe('max-age=31536000');
  });

  it('mirrors the baseline in public/_headers so static assets carry the same headers', () => {
    const file = readFileSync(new URL('../../public/_headers', import.meta.url), 'utf8');
    const expected = Object.fromEntries(
      Object.entries(SECURITY_HEADERS).map(([name, value]) => [name.toLowerCase(), value]),
    );

    expect(Object.keys(expected)).not.toHaveLength(0);
    expect(headersRule(file, '/*')).toEqual(expected);
  });
});

describe('applySecurityHeaders', () => {
  it('sets every baseline header and keeps the same response instance', () => {
    const response = new Response('ok');

    const result = applySecurityHeaders(response);

    expect(result).toBe(response);
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(result.headers.get(name)).toBe(value);
    }
  });

  it('keeps a header the route already chose', () => {
    const response = new Response('ok', { headers: { 'Referrer-Policy': 'no-referrer' } });

    const result = applySecurityHeaders(response);

    expect(result.headers.get('referrer-policy')).toBe('no-referrer');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('copes with a response whose headers are immutable', () => {
    const redirect = Response.redirect('https://tcn.example/next', 302);

    const result = applySecurityHeaders(redirect);

    expect(result.status).toBe(302);
    expect(result.headers.get('location')).toBe('https://tcn.example/next');
    expect(result.headers.get('x-content-type-options')).toBe('nosniff');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(result.headers.get(name)).toBe(value);
    }
  });
});
