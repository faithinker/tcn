import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
  env: {
    DB: null as unknown as D1Database,
    SESSION_SECRET: 'signup-route-secret',
    MEMBER_FEATURES_ENABLED: 'true',
    SIGNUP_ENABLED: 'true',
    AUTH_MAIL_MODE: 'local',
    LOGIN_CHALLENGE: 'off' as string | undefined,
    TURNSTILE_SECRET_KEY: undefined as string | undefined,
    QNA_TURNSTILE_HOSTNAMES: undefined as string | undefined,
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
  env.LOGIN_CHALLENGE = 'off';
  env.TURNSTILE_SECRET_KEY = undefined;
  env.QNA_TURNSTILE_HOSTNAMES = undefined;
  cookie = '';
});
afterEach(() => {
  vi.unstubAllGlobals();
  return h.dispose();
});
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
  it('stops reading a chunked body without Content-Length once it passes 8 KiB', async () => {
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (pulled >= 1000) return controller.close();
        pulled += 1;
        controller.enqueue(new Uint8Array(1024).fill(97));
      },
    });
    const url = new URL('http://localhost/api/auth/signup');
    const response = await POST({
      url,
      request: new Request(url, {
        method: 'POST',
        headers: { origin: url.origin, 'content-type': 'application/json', cookie },
        body: stream,
        duplex: 'half',
      } as RequestInit),
    } as unknown as Parameters<typeof POST>[0]);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ ok: false, error: 'body_too_large' });
    expect(pulled).toBeLessThan(50);
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

describe('signup start bot challenge', () => {
  const challengeOn = () => {
    env.LOGIN_CHALLENGE = undefined;
    env.TURNSTILE_SECRET_KEY = 'turnstile-secret';
    env.QNA_TURNSTILE_HOSTNAMES = 'localhost';
  };
  const siteverify = (overrides: Record<string, unknown> = {}) => {
    const spy = vi.fn().mockImplementation(async () =>
      Response.json({
        success: true,
        hostname: 'localhost',
        action: 'signup_start',
        challenge_ts: new Date().toISOString(),
        ...overrides,
      }),
    );
    vi.stubGlobal('fetch', spy);
    return spy;
  };
  const count = async (table: string) =>
    (await h.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n;
  const untouched = async () => {
    expect(await count('auth_email_challenges')).toBe(0);
    expect(await count('auth_local_mail')).toBe(0);
    expect(await count('auth_mail_limits')).toBe(0);
  };

  it('sends the code and sets the proof cookie once Siteverify accepts the token', async () => {
    challengeOn();
    const spy = siteverify();
    const response = await start(
      ctx('/api/auth/signup/start', { email: input.email, turnstileToken: 'widget-token' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie()[0]).toMatch(/^tcn_signup=/);
    expect(spy).toHaveBeenCalledOnce();
    expect(await count('auth_local_mail')).toBe(1);
  });

  it.each([
    ['no token', { email: input.email }],
    ['an empty token', { email: input.email, turnstileToken: '' }],
    ['a non-string token', { email: input.email, turnstileToken: { x: 1 } }],
  ])('refuses %s before touching mail, challenges or rate limits', async (_label, body) => {
    challengeOn();
    const spy = siteverify();
    const response = await start(ctx('/api/auth/signup/start', body));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'turnstile_failed' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
    await untouched();
  });

  it('refuses a token that Siteverify rejects or that was issued for another action', async () => {
    challengeOn();
    for (const overrides of [{ success: false }, { action: 'admin_login' }]) {
      siteverify(overrides);
      const response = await start(
        ctx('/api/auth/signup/start', { email: input.email, turnstileToken: 'widget-token' }),
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ ok: false, error: 'turnstile_failed' });
    }
    await untouched();
  });

  it('fails closed with 503 when Turnstile is not configured outside the local switch', async () => {
    env.LOGIN_CHALLENGE = undefined;
    const response = await start(
      ctx('/api/auth/signup/start', { email: input.email, turnstileToken: 'widget-token' }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'security_not_configured' });
    await untouched();
  });

  it('still rejects unknown fields and does not require a token behind the local off switch', async () => {
    challengeOn();
    const spy = siteverify();
    const unknown = await start(
      ctx('/api/auth/signup/start', { email: input.email, turnstileToken: 'x', role: 'officer' }),
    );
    expect(unknown.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    env.LOGIN_CHALLENGE = 'off';
    expect((await start(ctx('/api/auth/signup/start', { email: input.email }))).status).toBe(200);
  });

  it('leaves the verify, finish and cancel steps to the browser-bound proof, not a new token', async () => {
    challengeOn();
    siteverify();
    const started = await start(
      ctx('/api/auth/signup/start', { email: input.email, turnstileToken: 'widget-token' }),
    );
    cookie = started.headers.getSetCookie()[0].split(';')[0];
    const mail = await h.db
      .prepare('SELECT body FROM auth_local_mail ORDER BY rowid DESC LIMIT 1')
      .first<{ body: string }>();
    const code = mail!.body.match(/\b\d{6}\b/)![0];
    expect((await verify(ctx('/api/auth/signup/verify', { code }))).status).toBe(200);
    expect((await cancel(ctx('/api/auth/signup/cancel'))).status).toBe(200);
  });
});
