import { describe, expect, it } from 'vitest';

import { buildSessionCookie, clearSessionCookie, readSessionToken, SESSION_COOKIE } from './cookie';
import { SESSION_TTL_SECONDS } from './session';

describe('session cookie contract', () => {
  it('sets a host-wide HttpOnly cookie and adds Secure only for HTTPS', () => {
    const local = buildSessionCookie('signed-token', { secure: false });
    expect(local).toContain(`${SESSION_COOKIE}=signed-token`);
    expect(local).toContain('HttpOnly');
    expect(local).toContain('SameSite=Lax');
    expect(local).toContain('Path=/');
    expect(local).toContain(`Max-Age=${SESSION_TTL_SECONDS}`);
    expect(local).not.toContain('Secure');

    expect(buildSessionCookie('signed-token', { secure: true })).toContain('Secure');
  });

  it('expires the same cookie attributes during logout', () => {
    const cookie = clearSessionCookie({ secure: true });
    expect(cookie).toContain(`${SESSION_COOKIE}=;`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('reads an encoded token among unrelated cookies and handles missing input', () => {
    const request = new Request('https://tcn.example', {
      headers: { cookie: `theme=paper; ${SESSION_COOKIE}=signed%3Atoken; other=1` },
    });
    expect(readSessionToken(request)).toBe('signed:token');
    expect(readSessionToken(new Request('https://tcn.example'))).toBeNull();
  });
});
