import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
  env: {
    DB: null as unknown as D1Database,
    SESSION_SECRET: 'signup-route-secret',
    MEMBER_FEATURES_ENABLED: 'true',
    SIGNUP_ENABLED: 'true',
    AUTH_MAIL_MODE: 'local',
  },
}));
vi.mock('cloudflare:workers', () => ({ env }));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { POST } from '../../pages/api/auth/signup';
import { POST as start } from '../../pages/api/auth/signup/start';
import { POST as verify } from '../../pages/api/auth/signup/verify';
import { POST as cancel } from '../../pages/api/auth/signup/cancel';
import { GET as state } from '../../pages/api/auth/signup/state';
import { getSessionUser } from '../auth/guard';
import { verifyPassword } from '../auth/password';
let h: TestD1, cookie: string;
const input = {
  email: 'new@example.org',
  displayName: 'New Member',
  affiliation: 'Institute',
  password: 'A fresh phrase beside the river',
  passwordConfirmation: 'A fresh phrase beside the river',
};
function ctx(path: string, body: unknown = {}, headers: HeadersInit = {}) {
  const url = new URL('http://localhost' + path);
  return {
    url,
    request: new Request(url, {
      method: path.endsWith('/state') ? 'GET' : 'POST',
      headers: { origin: url.origin, 'content-type': 'application/json', cookie, ...headers },
      ...(!path.endsWith('/state') ? { body: JSON.stringify(body) } : {}),
    }),
  } as unknown as Parameters<typeof POST>[0];
}
async function prove() {
  const r = await start(ctx('/api/auth/signup/start', { email: input.email }));
  expect(r.status).toBe(200);
  cookie = r.headers.getSetCookie()[0].split(';')[0];
  const mail = await h.db
    .prepare('SELECT body FROM auth_local_mail ORDER BY rowid DESC LIMIT 1')
    .first<{ body: string }>();
  const r2 = await verify(
    ctx('/api/auth/signup/verify', { code: mail!.body.match(/\b\d{6}\b/)![0] }),
  );
  expect(r2.status).toBe(200);
}
beforeEach(async () => {
  h = await openTestD1();
  env.DB = h.db;
  env.SIGNUP_ENABLED = 'true';
  env.MEMBER_FEATURES_ENABLED = 'true';
  cookie = '';
});
afterEach(() => h.dispose());
describe('verified signup routes', () => {
  it('gates all steps and status behind signup/member flags', async () => {
    env.SIGNUP_ENABLED = 'false';
    for (const route of [POST, start, verify, cancel])
      expect((await route(ctx('/api/auth/signup', input))).status).toBe(404);
    expect((await state(ctx('/api/auth/signup/state'))).status).toBe(404);
    env.SIGNUP_ENABLED = 'true';
    env.MEMBER_FEATURES_ENABLED = 'false';
    expect((await POST(ctx('/api/auth/signup', input))).status).toBe(503);
  });
  it('rejects hostile origin, cross-site requests and oversized or wrong content types', async () => {
    const invalidHeaders: Record<string, string>[] = [
      { origin: '' },
      { origin: 'https://evil.org' },
      { 'sec-fetch-site': 'cross-site' },
    ];
    for (const headers of invalidHeaders)
      expect((await POST(ctx('/api/auth/signup', input, headers))).status).toBe(403);
    expect(
      (await POST(ctx('/api/auth/signup', input, { 'content-type': 'text/plain' }))).status,
    ).toBe(415);
    expect((await POST(ctx('/api/auth/signup', { affiliation: 'x'.repeat(9000) }))).status).toBe(
      413,
    );
  });
  it('rejects unverified signup and privilege injection', async () => {
    expect((await POST(ctx('/api/auth/signup', input))).status).toBe(400);
    expect((await POST(ctx('/api/auth/signup', { ...input, role: 'officer' }))).status).toBe(400);
  });
  it('creates a verified pending member and a usable server-validated session', async () => {
    await prove();
    const response = await POST(ctx('/api/auth/signup', input));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true, redirectTo: '/account' });
    const session = response.headers
      .getSetCookie()
      .find((x) => x.startsWith('tcn_session='))!
      .split(';')[0];
    expect(
      await getSessionUser(
        new Request('http://localhost/account', { headers: { cookie: session } }),
      ),
    ).toMatchObject({
      username: input.email,
      status: 'pending',
      role: 'member',
      isExecutive: false,
    });
    const row = await h.db
      .prepare('SELECT password_hash,email_verified_at,affiliation FROM users WHERE username=?')
      .bind(input.email)
      .first<{ password_hash: string; email_verified_at: number; affiliation: string }>();
    expect(row!.email_verified_at).toBeGreaterThan(0);
    expect(await verifyPassword(input.password, row!.password_hash)).toBe(true);
    expect((await POST(ctx('/api/auth/signup', input))).status).toBe(400);
  });
  it('only reveals a duplicate after mailbox verification', async () => {
    await h.db
      .prepare("INSERT INTO users(id,username,password_hash) VALUES ('existing',?,'!')")
      .bind(input.email)
      .run();
    await prove();
    expect((await POST(ctx('/api/auth/signup', input))).status).toBe(409);
  });
  it('restores only the matching browser state and discards it when changing email', async () => {
    await prove();
    expect(await (await state(ctx('/api/auth/signup/state'))).json()).toMatchObject({
      state: { email: input.email, verified: true },
    });
    expect((await cancel(ctx('/api/auth/signup/cancel'))).status).toBe(200);
    expect(await (await state(ctx('/api/auth/signup/state'))).json()).toMatchObject({
      state: null,
    });
  });
});
