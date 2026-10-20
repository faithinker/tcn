import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));

import { base64UrlEncode, hmacSha256 } from '../crypto';
import { createCsrfToken, requireMutation, SecurityError, verifyCsrfToken } from './mutation';
import type { SessionUser } from './permissions';

function account(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'admin-1',
    username: 'admin',
    displayName: 'Admin',
    role: 'officer',
    status: 'approved',
    isExecutive: false,
    canAccessDirectorsForum: false,
    ...overrides,
  };
}

function mutationRequest(overrides: { origin?: string | null; site?: string; csrf?: string } = {}) {
  const headers = new Headers({
    cookie: 'tcn_session=signed-session',
    origin: overrides.origin === undefined ? 'https://tcn.example' : (overrides.origin ?? ''),
    'sec-fetch-site': overrides.site ?? 'same-origin',
    'x-csrf-token': overrides.csrf ?? '',
  });
  if (overrides.origin === null) headers.delete('origin');
  return new Request('https://tcn.example/api/questions/q-1/answer', { method: 'PUT', headers });
}

const officerOnQna = { scope: 'qna', require: 'officer' } as const;

describe('requireMutation', () => {
  it('accepts a valid session, exact origin, Fetch Metadata and CSRF token', async () => {
    const csrf = await createCsrfToken('qna', 'signed-session', 'secret');
    const user = account();

    await expect(
      requireMutation(mutationRequest({ csrf }), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(user),
        sessionSecret: 'secret',
      }),
    ).resolves.toEqual({ user });
  });

  it.each([
    [{ origin: null }, 'invalid_origin'],
    [{ origin: 'https://evil.example' }, 'invalid_origin'],
    [{ site: 'cross-site' }, 'cross_site_request'],
    [{ csrf: 'forged' }, 'invalid_csrf'],
  ])('rejects mutation header attack %#', async (overrides, code) => {
    const csrf = await createCsrfToken('qna', 'signed-session', 'secret');
    await expect(
      requireMutation(mutationRequest({ csrf, ...overrides }), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(account()),
        sessionSecret: 'secret',
      }),
    ).rejects.toMatchObject({ code, status: 403 });
  });

  it('rejects an invalid session before accepting any mutation metadata', async () => {
    await expect(
      requireMutation(mutationRequest(), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(null),
        sessionSecret: 'secret',
      }),
    ).rejects.toMatchObject({ code: 'unauthorized', status: 401 });
  });

  it.each([
    ['a member', account({ role: 'member' }), officerOnQna],
    ['a pending officer', account({ status: 'pending' }), officerOnQna],
    ['a rejected officer', account({ status: 'rejected' }), officerOnQna],
    ['an officer on an executive route', account(), { scope: 'users', require: 'executive' }],
    [
      'a member carrying the executive flag',
      account({ role: 'member', isExecutive: true }),
      { scope: 'users', require: 'executive' },
    ],
  ] as const)(
    'answers 403 forbidden to %s even with valid headers',
    async (_label, user, options) => {
      const csrf = await createCsrfToken(options.scope, 'signed-session', 'secret');
      await expect(
        requireMutation(mutationRequest({ csrf }), options, {
          getUser: vi.fn().mockResolvedValue(user),
          sessionSecret: 'secret',
        }),
      ).rejects.toMatchObject({ code: 'forbidden', status: 403 });
    },
  );

  it('lets an executive through an executive route and a pending account through an active-account route', async () => {
    const usersCsrf = await createCsrfToken('users', 'signed-session', 'secret');
    const executive = account({ isExecutive: true });
    await expect(
      requireMutation(
        mutationRequest({ csrf: usersCsrf }),
        { scope: 'users', require: 'executive' },
        { getUser: vi.fn().mockResolvedValue(executive), sessionSecret: 'secret' },
      ),
    ).resolves.toEqual({ user: executive });

    const forumCsrf = await createCsrfToken('forum', 'signed-session', 'secret');
    const pending = account({ role: 'member', status: 'pending' });
    await expect(
      requireMutation(
        mutationRequest({ csrf: forumCsrf }),
        { scope: 'forum', require: 'activeAccount' },
        { getUser: vi.fn().mockResolvedValue(pending), sessionSecret: 'secret' },
      ),
    ).resolves.toEqual({ user: pending });
  });

  it('checks origin and CSRF before the role, as the Q&A guard always did', async () => {
    await expect(
      requireMutation(mutationRequest({ csrf: 'forged' }), officerOnQna, {
        getUser: vi.fn().mockResolvedValue(account({ role: 'member' })),
        sessionSecret: 'secret',
      }),
    ).rejects.toMatchObject({ code: 'invalid_csrf', status: 403 });
  });
});

describe('scoped CSRF tokens', () => {
  it('binds a token to its session and verifies in constant time', async () => {
    const token = await createCsrfToken('qna', 'session-a', 'secret');
    await expect(verifyCsrfToken(token, 'qna', 'session-a', 'secret')).resolves.toBe(true);
    await expect(verifyCsrfToken(token, 'qna', 'session-b', 'secret')).resolves.toBe(false);
  });

  it('does not accept a token minted for another scope', async () => {
    const token = await createCsrfToken('qna', 'session-a', 'secret');
    await expect(verifyCsrfToken(token, 'forum', 'session-a', 'secret')).resolves.toBe(false);
    await expect(verifyCsrfToken(token, 'users', 'session-a', 'secret')).resolves.toBe(false);
  });

  it('keeps the legacy Q&A token format so open admin screens survive the deploy', async () => {
    const legacy = base64UrlEncode(await hmacSha256('qna-csrf:signed-session', 'secret'));
    await expect(createCsrfToken('qna', 'signed-session', 'secret')).resolves.toBe(legacy);
    await expect(verifyCsrfToken(legacy, 'qna', 'signed-session', 'secret')).resolves.toBe(true);
  });
});

describe('SecurityError', () => {
  it('carries the code and status the API responds with', () => {
    const error = new SecurityError('forbidden', 403);
    expect(error).toMatchObject({ code: 'forbidden', status: 403, message: 'forbidden' });
  });
});
