import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
  env: {
    DB: null as unknown as D1Database,
    SESSION_SECRET: 'session-test',
    MEMBER_FEATURES_ENABLED: 'true',
  },
}));
vi.mock('cloudflare:workers', () => ({ env }));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { createSessionToken } from '../auth/session';
import { createCsrfToken } from '../auth/mutation';
import { POST as logout } from '../../pages/api/auth/logout';
import { GET as me } from '../../pages/api/auth/me';
let h: TestD1, token: string, csrf: string;
beforeEach(async () => {
  h = await openTestD1();
  env.DB = h.db;
  await h.db
    .prepare(
      "INSERT INTO users(id,username,password_hash,role,status,is_executive) VALUES ('user','editor','!','officer','approved',1)",
    )
    .run();
  token = await createSessionToken('user', env.SESSION_SECRET);
  csrf = await createCsrfToken('account' as never, token, env.SESSION_SECRET);
});
afterEach(() => h.dispose());
function context(path: string, headers: Record<string, string> = {}) {
  const url = new URL('https://tcn.example' + path);
  return {
    url,
    request: new Request(url, {
      method: path.endsWith('/me') ? 'GET' : 'POST',
      headers: {
        origin: url.origin,
        cookie: 'tcn_session=' + token,
        'x-csrf-token': csrf,
        ...headers,
      },
    }),
  } as unknown as Parameters<typeof logout>[0];
}
describe('account session endpoints', () => {
  it('rejects cross-origin and missing-CSRF logout without revoking sessions', async () => {
    expect(
      (await logout(context('/api/auth/logout', { origin: 'https://evil.example' }))).status,
    ).toBe(403);
    expect((await logout(context('/api/auth/logout', { 'x-csrf-token': '' }))).status).toBe(403);
    expect(await (await me(context('/api/auth/me'))).json()).toMatchObject({ authenticated: true });
  });
  it('records a sign-out, and nothing for a rejected or anonymous one', async () => {
    const rows = async () =>
      (await h.db.prepare('SELECT user_id, event, staff FROM auth_events').all()).results;

    await logout(context('/api/auth/logout', { origin: 'https://evil.example' }));
    await logout(context('/api/auth/logout', { cookie: '' }));
    expect(await rows()).toEqual([]);

    await logout(context('/api/auth/logout'));
    expect(await rows()).toEqual([{ user_id: 'user', event: 'logout', staff: 1 }]);
  });

  it('revokes every session and clears the session and signup cookies but keeps the trusted-device cookie', async () => {
    const r = await logout(context('/api/auth/logout'));
    expect(r.status).toBe(200);
    const cookies = r.headers.getSetCookie();
    expect(cookies.find((v) => v.startsWith('tcn_session='))).toContain('Max-Age=0');
    expect(cookies.find((v) => v.startsWith('tcn_signup='))).toContain('Max-Age=0');
    expect(cookies.some((v) => v.startsWith('tcn_device='))).toBe(false);
    expect(await (await me(context('/api/auth/me'))).json()).toMatchObject({
      authenticated: false,
    });
  });
  it('allows an already-ended same-origin session to clear its cookie idempotently', async () => {
    expect((await logout(context('/api/auth/logout', { cookie: '' }))).status).toBe(200);
  });
  it('provides an account CSRF token only to authenticated callers without leaking privilege flags', async () => {
    const r = (await (await me(context('/api/auth/me'))).json()) as {
      user: Record<string, unknown>;
    };
    expect(r).toMatchObject({
      authenticated: true,
      csrfToken: csrf,
      user: { username: 'editor' },
      capabilities: { manageUsers: true },
    });
    expect(r.user).not.toHaveProperty('isExecutive');
    const anonymous = await (await me(context('/api/auth/me', { cookie: '' }))).json();
    expect(anonymous).not.toHaveProperty('csrfToken');
  });
  it('rejects cross-site Fetch Metadata on /api/auth/me without minting a CSRF token or leaking user state', async () => {
    const response = await me(context('/api/auth/me', { 'sec-fetch-site': 'cross-site' }));
    expect(response.status).toBe(403);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'cross_site_request' });
  });
});

it('expires invalidated session cookies without wiping the trusted-device cookie when another device checks its session', async () => {
  await env.DB.prepare("UPDATE users SET session_version=session_version+1 WHERE id='user'").run();
  const result = await me(context('/api/auth/me'));
  expect(result.headers.get('cache-control')).toBe('no-store');
  expect(await result.json()).toMatchObject({ authenticated: false });
  const cookies = result.headers.getSetCookie();
  expect(cookies.find((value) => value.startsWith('tcn_session='))).toContain('Max-Age=0');
  expect(cookies.some((value) => value.startsWith('tcn_device='))).toBe(false);
});
