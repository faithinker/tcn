vi.mock('../account/password-safety', () => ({ assertPasswordNotBreached: vi.fn(async () => {}) }));
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const { env } = vi.hoisted(() => ({
  env: {
    DB: null as unknown as D1Database,
    SESSION_SECRET: 'account-test',
    MEMBER_FEATURES_ENABLED: 'true',
  },
}));
vi.mock('cloudflare:workers', () => ({ env }));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { hashPassword } from '../auth/password';
import { createSessionToken } from '../auth/session';
import { createCsrfToken } from '../auth/mutation';
import { PATCH } from '../../pages/api/account/profile';
import { POST as password } from '../../pages/api/account/password';
import { POST as withdraw } from '../../pages/api/account/withdraw';
let h: TestD1;
let token: string;
let csrf: string;
beforeEach(async () => {
  h = await openTestD1();
  env.DB = h.db;
  await h.db
    .prepare(
      "INSERT INTO users(id,username,password_hash,role,status) VALUES ('member','person@example.org',?,'member','rejected')",
    )
    .bind(await hashPassword('An old password by the river'))
    .run();
  token = await createSessionToken('member', env.SESSION_SECRET);
  csrf = await createCsrfToken('account' as never, token, env.SESSION_SECRET);
});
afterEach(() => h.dispose());
function ctx(path: string, body: unknown, overrides: Record<string, string> = {}) {
  const url = new URL('https://tcn.example' + path);
  return {
    url,
    request: new Request(url, {
      method: path.endsWith('profile') ? 'PATCH' : 'POST',
      headers: {
        origin: url.origin,
        cookie: 'tcn_session=' + token,
        'x-csrf-token': csrf,
        'content-type': 'application/json',
        ...overrides,
      },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof PATCH>[0];
}
it('allows a rejected user to edit only their own display fields', async () => {
  const r = await PATCH(
    ctx('/api/account/profile', { displayName: 'Researcher', affiliation: '' }),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({
    profile: { displayName: 'Researcher', affiliation: null },
  });
});
it('rejects missing CSRF, cross-site origin and injected identity', async () => {
  expect(
    (await PATCH(ctx('/api/account/profile', { displayName: 'X' }, { 'x-csrf-token': '' }))).status,
  ).toBe(403);
  expect(
    (await PATCH(ctx('/api/account/profile', { displayName: 'X' }, { origin: 'https://evil.org' })))
      .status,
  ).toBe(403);
  expect(
    (await PATCH(ctx('/api/account/profile', { displayName: 'X', email: 'other@example.org' })))
      .status,
  ).toBe(400);
});
it('does not change credentials on a wrong current password', async () => {
  const r = await password(
    ctx('/api/account/password', {
      currentPassword: 'wrong',
      newPassword: 'A fresh phrase beside the river',
      passwordConfirmation: 'A fresh phrase beside the river',
    }),
  );
  expect(r.status).toBe(400);
  expect(r.headers.get('set-cookie')).toBeNull();
});
it('changes password and expires session and trusted device cookies on their actual paths', async () => {
  const r = await password(
    ctx('/api/account/password', {
      currentPassword: 'An old password by the river',
      newPassword: 'A fresh phrase beside the river',
      passwordConfirmation: 'A fresh phrase beside the river',
    }),
  );
  expect(r.status).toBe(200);
  const cookies = r.headers.getSetCookie();
  expect(cookies).toEqual(
    expect.arrayContaining([
      expect.stringContaining('tcn_session=;'),
      expect.stringContaining('tcn_device=;'),
    ]),
  );
  expect(cookies.find((x) => x.startsWith('tcn_device='))).toContain('Path=/api/auth/login');
  expect((await PATCH(ctx('/api/account/profile', { displayName: 'Stale' }))).status).toBe(401);
});
it('requires explicit confirmation before withdrawal', async () => {
  expect(
    (
      await withdraw(
        ctx('/api/account/withdraw', {
          currentPassword: 'An old password by the river',
          requestId: 'withdraw-0001',
          confirmation: false,
        }),
      )
    ).status,
  ).toBe(400);
});
it('withdraws then prevents every reuse of the old session', async () => {
  const r = await withdraw(
    ctx('/api/account/withdraw', {
      currentPassword: 'An old password by the river',
      requestId: 'withdraw-0002',
      confirmation: true,
    }),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ redirectTo: '/account/withdrawn' });
  expect((await PATCH(ctx('/api/account/profile', { displayName: 'Stale' }))).status).toBe(401);
});
const MAIL_ENV = {
  RESEND_API_KEY: 'test-key',
  AUTH_MAIL_FROM: 'accounts@tcn.example',
  AUTH_PUBLIC_ORIGIN: 'https://tcn.example',
};
const closeAccount = {
  currentPassword: 'An old password by the river',
  requestId: 'withdraw-0003',
  confirmation: true,
};
const changePassword = {
  currentPassword: 'An old password by the river',
  newPassword: 'A different phrase by the sea',
  passwordConfirmation: 'A different phrase by the sea',
};
it.each([
  ['withdrawal', withdraw, '/api/account/withdraw', closeAccount],
  ['password change', password, '/api/account/password', changePassword],
] as const)(
  'answers a %s without waiting for the security notice when the runtime can run it later',
  async (_name, route, path, body) => {
    Object.assign(env, MAIL_ENV);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const network = vi.fn(async () => {
      await gate;
      return Response.json({ id: 'mail' });
    });
    vi.stubGlobal('fetch', network);
    const tasks: Promise<unknown>[] = [];
    try {
      const context = {
        ...ctx(path, body),
        locals: { cfContext: { waitUntil: (task: Promise<unknown>) => tasks.push(task) } },
      };
      const outcome = await Promise.race([
        route(context as never),
        new Promise<string>((resolve) => setTimeout(() => resolve('blocked'), 300)),
      ]);
      expect(outcome).not.toBe('blocked');
      expect((outcome as Response).status).toBe(200);
      expect(tasks).toHaveLength(1);
    } finally {
      release();
      await Promise.all(tasks);
      expect(network).toHaveBeenCalledOnce();
      vi.unstubAllGlobals();
      for (const key of Object.keys(MAIL_ENV)) delete (env as Record<string, unknown>)[key];
    }
  },
);
it('still sends the security notice before answering when there is no way to run it later', async () => {
  Object.assign(env, MAIL_ENV);
  const network = vi.fn(async () => Response.json({ id: 'mail' }));
  vi.stubGlobal('fetch', network);
  try {
    const response = await withdraw(ctx('/api/account/withdraw', closeAccount));
    expect(response.status).toBe(200);
    expect(network).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
    for (const key of Object.keys(MAIL_ENV)) delete (env as Record<string, unknown>)[key];
  }
});
