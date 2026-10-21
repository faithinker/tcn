import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
  env: {
    DB: null as unknown as D1Database,
    SESSION_SECRET: 'reset-test',
    MEMBER_FEATURES_ENABLED: 'true',
    SIGNUP_ENABLED: 'false',
    AUTH_MAIL_MODE: 'local',
    LOGIN_CHALLENGE: 'off' as string | undefined,
    TURNSTILE_SECRET_KEY: undefined as string | undefined,
    QNA_TURNSTILE_HOSTNAMES: undefined as string | undefined,
  },
}));
vi.mock('cloudflare:workers', () => ({ env }));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { hashPassword, verifyPassword } from '../auth/password';
import { POST as requestReset } from '../../pages/api/auth/forgot-password';
import { POST as reset } from '../../pages/api/auth/reset-password';
let h: TestD1;
beforeEach(async () => {
  h = await openTestD1();
  env.DB = h.db;
  env.MEMBER_FEATURES_ENABLED = 'true';
  env.LOGIN_CHALLENGE = 'off';
  env.TURNSTILE_SECRET_KEY = undefined;
  env.QNA_TURNSTILE_HOSTNAMES = undefined;
  await h.db
    .prepare(
      "INSERT INTO users(id,username,password_hash,email_verified_at) VALUES ('member','member@example.org',?,1)",
    )
    .bind(await hashPassword('An old phrase beside the river'))
    .run();
});
afterEach(() => {
  vi.unstubAllGlobals();
  return h.dispose();
});
function ctx(path: string, body: unknown, origin = 'http://localhost') {
  const url = new URL('http://localhost' + path);
  return {
    url,
    request: new Request(url, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof reset>[0];
}
it('keeps recovery available when signup is off and gives the same response for unknown emails', async () => {
  const known = await requestReset(
    ctx('/api/auth/forgot-password', { email: 'member@example.org' }),
  );
  const unknown = await requestReset(
    ctx('/api/auth/forgot-password', { email: 'unknown@example.org' }),
  );
  expect(known.status).toBe(200);
  expect(await known.json()).toEqual(await unknown.json());
  expect((await h.db.prepare('SELECT * FROM auth_local_mail').all()).results).toHaveLength(1);
});
it('uses a one-time reset link and expires login cookies after the new password is stored', async () => {
  await requestReset(ctx('/api/auth/forgot-password', { email: 'member@example.org' }));
  const mail = await h.db
    .prepare('SELECT body FROM auth_local_mail ORDER BY rowid DESC LIMIT 1')
    .first<{ body: string }>();
  const token = new URL(mail!.body.match(/http[^\s]+/)![0]).searchParams.get('token');
  const input = {
    token,
    password: 'A new phrase beside the river',
    passwordConfirmation: 'A new phrase beside the river',
  };
  const result = await reset(ctx('/api/auth/reset-password', input));
  expect(result.status).toBe(200);
  expect(result.headers.getSetCookie().find((x) => x.startsWith('tcn_session='))).toContain(
    'Max-Age=0',
  );
  const user = await h.db
    .prepare("SELECT password_hash,session_version FROM users WHERE id='member'")
    .first<{ password_hash: string; session_version: number }>();
  expect(user!.session_version).toBe(2);
  expect(await verifyPassword(input.password, user!.password_hash)).toBe(true);
  expect((await reset(ctx('/api/auth/reset-password', input))).status).toBe(400);
});
it('rejects expired proof, cross-origin requests, extra fields and disabled member features', async () => {
  expect(
    (
      await reset(
        ctx('/api/auth/reset-password', {
          token: 'invalid',
          password: 'A new phrase beside the river',
          passwordConfirmation: 'A new phrase beside the river',
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await requestReset(
        ctx('/api/auth/forgot-password', { email: 'member@example.org' }, 'https://evil.org'),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await requestReset(
        ctx('/api/auth/forgot-password', { email: 'member@example.org', role: 'officer' }),
      )
    ).status,
  ).toBe(400);
  env.MEMBER_FEATURES_ENABLED = 'false';
  expect(
    (await requestReset(ctx('/api/auth/forgot-password', { email: 'member@example.org' }))).status,
  ).toBe(503);
});

describe('reset request bot challenge', () => {
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
        action: 'password_reset',
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
  const body = { email: 'member@example.org', turnstileToken: 'widget-token' };

  it('sends the reset link once Siteverify accepts the token', async () => {
    challengeOn();
    const spy = siteverify();
    const response = await requestReset(ctx('/api/auth/forgot-password', body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(spy).toHaveBeenCalledOnce();
    expect(await count('auth_local_mail')).toBe(1);
  });

  it('gives an unknown email the same accepted response behind a valid token', async () => {
    challengeOn();
    siteverify();
    const known = await requestReset(ctx('/api/auth/forgot-password', body));
    const unknown = await requestReset(
      ctx('/api/auth/forgot-password', { ...body, email: 'unknown@example.org' }),
    );
    expect(unknown.status).toBe(known.status);
    expect(await unknown.json()).toEqual(await known.json());
  });

  it.each([
    ['no token', { email: 'member@example.org' }],
    ['an empty token', { email: 'member@example.org', turnstileToken: '' }],
    ['a non-string token', { email: 'member@example.org', turnstileToken: { x: 1 } }],
  ])('refuses %s before touching mail, challenges or rate limits', async (_label, input) => {
    challengeOn();
    const spy = siteverify();
    const response = await requestReset(ctx('/api/auth/forgot-password', input));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: 'turnstile_failed' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(spy).not.toHaveBeenCalled();
    await untouched();
  });

  it('refuses a rejected token and a token issued for the signup action', async () => {
    challengeOn();
    for (const overrides of [{ success: false }, { action: 'signup_start' }]) {
      siteverify(overrides);
      const response = await requestReset(ctx('/api/auth/forgot-password', body));
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ ok: false, error: 'turnstile_failed' });
    }
    await untouched();
  });

  it('fails closed with 503 when Turnstile is not configured outside the local switch', async () => {
    env.LOGIN_CHALLENGE = undefined;
    const response = await requestReset(ctx('/api/auth/forgot-password', body));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'security_not_configured' });
    await untouched();
  });

  it('rejects unknown fields before Siteverify and needs no token behind the local off switch', async () => {
    challengeOn();
    const spy = siteverify();
    const unknown = await requestReset(
      ctx('/api/auth/forgot-password', { ...body, role: 'officer' }),
    );
    expect(unknown.status).toBe(400);
    expect(spy).not.toHaveBeenCalled();
    env.LOGIN_CHALLENGE = 'off';
    expect(
      (await requestReset(ctx('/api/auth/forgot-password', { email: 'member@example.org' })))
        .status,
    ).toBe(200);
  });

  it('does not challenge the final reset, which is already bound to its one-time link', async () => {
    challengeOn();
    const spy = siteverify();
    await requestReset(ctx('/api/auth/forgot-password', body));
    const mail = await h.db
      .prepare('SELECT body FROM auth_local_mail ORDER BY rowid DESC LIMIT 1')
      .first<{ body: string }>();
    const token = new URL(mail!.body.match(/http[^\s]+/)![0]).searchParams.get('token');
    spy.mockClear();
    const input = {
      token,
      password: 'A new phrase beside the river',
      passwordConfirmation: 'A new phrase beside the river',
    };
    expect((await reset(ctx('/api/auth/reset-password', input))).status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });
});
