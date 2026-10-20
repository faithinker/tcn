import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
  env: {
    DB: null as unknown as D1Database,
    SESSION_SECRET: 'reset-test',
    MEMBER_FEATURES_ENABLED: 'true',
    SIGNUP_ENABLED: 'false',
    AUTH_MAIL_MODE: 'local',
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
  await h.db
    .prepare(
      "INSERT INTO users(id,username,password_hash,email_verified_at) VALUES ('member','member@example.org',?,1)",
    )
    .bind(await hashPassword('An old phrase beside the river'))
    .run();
});
afterEach(() => h.dispose());
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
