import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildDeviceCookie,
  buildSessionCookie,
  clearLoginFailures,
  createDeviceToken,
  createSessionToken,
  deviceRateLimitKey,
  env,
  getDB,
  getLoginLockSeconds,
  getLoginRateLimitKeys,
  getSessionSecret,
  getUserByUsername,
  pruneLoginRateLimits,
  readDeviceToken,
  recordAuthEvent,
  recordLoginFailure,
  requireLoginChallenge,
  resetLoginAttempts,
  verifyDeviceToken,
  verifyPassword,
} = vi.hoisted(() => ({
  buildDeviceCookie: vi.fn((token: string) => `tcn_device=${token}`),
  buildSessionCookie: vi.fn(() => 'tcn_session=token'),
  clearLoginFailures: vi.fn(),
  createDeviceToken: vi.fn(),
  createSessionToken: vi.fn(() => 'token'),
  deviceRateLimitKey: vi.fn(),
  env: { TURNSTILE_SECRET_KEY: 'turnstile-secret', QNA_TURNSTILE_HOSTNAMES: 'tcn.example' },
  getDB: vi.fn(() => ({})),
  getLoginLockSeconds: vi.fn(),
  getLoginRateLimitKeys: vi.fn(() => Promise.resolve(['account:key', 'ip:key'])),
  getSessionSecret: vi.fn(() => 'secret'),
  getUserByUsername: vi.fn(),
  pruneLoginRateLimits: vi.fn(),
  readDeviceToken: vi.fn(),
  recordAuthEvent: vi.fn(),
  recordLoginFailure: vi.fn(),
  requireLoginChallenge: vi.fn(),
  resetLoginAttempts: vi.fn(),
  verifyDeviceToken: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../auth/login-challenge', () => ({ requireLoginChallenge }));
vi.mock('../auth/device', () => ({
  buildDeviceCookie,
  createDeviceToken,
  deviceRateLimitKey,
  readDeviceToken,
  verifyDeviceToken,
}));
vi.mock('../auth', () => ({
  buildSessionCookie,
  createSessionToken,
  DUMMY_PASSWORD_HASH: 'dummy-hash',
  getSessionSecret,
  verifyPassword,
}));
vi.mock('../auth/rate-limit', () => ({
  clearLoginFailures,
  getLoginLockSeconds,
  getLoginRateLimitKeys,
  pruneLoginRateLimits,
  recordLoginFailure,
  resetLoginAttempts,
}));
vi.mock('../auth/auth-log', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../auth/auth-log')>()),
  recordAuthEvent,
}));
vi.mock('../db', () => ({ getDB, getUserByUsername }));

import { POST } from '../../pages/api/auth/login';
import { TurnstileError } from '../turnstile';

function context(request?: Request) {
  return {
    request:
      request ??
      new Request('https://tcn.example/api/auth/login', {
        method: 'POST',
        headers: {
          origin: 'https://tcn.example',
          'content-type': 'application/json',
          'cf-connecting-ip': '203.0.113.10',
        },
        body: JSON.stringify({
          username: 'editor',
          password: 'secret',
          turnstileToken: 'turnstile-token',
        }),
      }),
    url: new URL('https://tcn.example/api/auth/login'),
  } as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLoginLockSeconds.mockResolvedValue(0);
    recordLoginFailure.mockResolvedValue(0);
    recordAuthEvent.mockResolvedValue(true);
    clearLoginFailures.mockResolvedValue(undefined);
    resetLoginAttempts.mockResolvedValue(undefined);
    pruneLoginRateLimits.mockResolvedValue(undefined);
    requireLoginChallenge.mockResolvedValue(undefined);
    readDeviceToken.mockReturnValue(null);
    verifyDeviceToken.mockResolvedValue(null);
    deviceRateLimitKey.mockResolvedValue('device:key');
    createDeviceToken.mockResolvedValue({ token: 'device-token', deviceId: 'new-device' });
  });

  it('rejects missing origin, foreign origin and cross-site Fetch Metadata before Turnstile or D1', async () => {
    for (const [headers, error] of [
      [{ 'content-type': 'application/json' }, 'invalid_origin'],
      [{ origin: 'https://evil.example', 'content-type': 'application/json' }, 'invalid_origin'],
      [
        {
          origin: 'https://tcn.example',
          'sec-fetch-site': 'cross-site',
          'content-type': 'application/json',
        },
        'cross_site_request',
      ],
    ] as const) {
      const response = await POST!(
        context(
          new Request('https://tcn.example/api/auth/login', {
            method: 'POST',
            headers,
            body: JSON.stringify({ username: 'editor', password: 'secret' }),
          }),
        ),
      );
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ ok: false, error });
    }
    expect(requireLoginChallenge).not.toHaveBeenCalled();
    expect(getUserByUsername).not.toHaveBeenCalled();
  });

  it('returns a safe member destination without exposing internal privilege flags', async () => {
    getUserByUsername.mockResolvedValue({
      id: 'member',
      username: 'reader',
      displayName: 'Reader',
      sessionVersion: 0,
      role: 'member',
      status: 'pending',
    });
    verifyPassword.mockResolvedValue(true);
    const response = await POST!(
      context(
        new Request('https://tcn.example/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'reader', password: 'secret', returnTo: '//evil.org' }),
        }),
      ),
    );
    expect(await response.json()).toMatchObject({
      redirectTo: '/forum/assembly',
      user: { role: 'member', status: 'pending' },
    });
  });
  it('normalizes email credentials while retaining legacy username lookup', async () => {
    getUserByUsername.mockResolvedValue(null);
    await POST!(
      context(
        new Request('https://tcn.example/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
          body: JSON.stringify({ username: ' Reader@Example.ORG ', password: 'secret' }),
        }),
      ),
    );
    expect(getUserByUsername).toHaveBeenCalledWith(expect.anything(), 'reader@example.org');
  });

  it('preserves an exact legacy mixed-case email-shaped username', async () => {
    const legacy = {
      id: 'legacy',
      username: 'Editor@Example.org',
      displayName: 'Legacy editor',
      sessionVersion: 1,
      role: 'officer',
      status: 'approved',
      passwordHash: 'legacy-hash',
    };
    getUserByUsername.mockImplementation(async (_db, value) =>
      value === legacy.username ? legacy : null,
    );
    verifyPassword.mockResolvedValue(true);
    const response = await POST!(
      context(
        new Request('https://tcn.example/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
          body: JSON.stringify({ username: legacy.username, password: 'secret' }),
        }),
      ),
    );
    expect(response.status).toBe(200);
    expect(getUserByUsername).toHaveBeenCalledExactlyOnceWith(expect.anything(), legacy.username);
  });

  it('does not switch to a case-distinct account after an exact username password fails', async () => {
    const exact = {
      id: 'upper',
      username: 'Reader@Example.org',
      passwordHash: 'upper-hash',
      sessionVersion: 1,
    };
    getUserByUsername.mockImplementation(async (_db, value) =>
      value === exact.username ? exact : { ...exact, id: 'lower', username: 'reader@example.org' },
    );
    verifyPassword.mockResolvedValue(false);
    const response = await POST!(
      context(
        new Request('https://tcn.example/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
          body: JSON.stringify({ username: exact.username, password: 'secret' }),
        }),
      ),
    );
    expect(response.status).toBe(401);
    expect(getUserByUsername).toHaveBeenCalledExactlyOnceWith(expect.anything(), exact.username);
  });

  describe('Turnstile challenge', () => {
    it('verifies the token from a JSON body against the request URL and client IP', async () => {
      getUserByUsername.mockResolvedValue(null);

      await POST!(context());

      expect(requireLoginChallenge).toHaveBeenCalledWith({
        token: 'turnstile-token',
        remoteIp: '203.0.113.10',
        url: new URL('https://tcn.example/api/auth/login'),
        bindings: env,
      });
    });

    it('reads the standard widget field from a form-encoded body', async () => {
      getUserByUsername.mockResolvedValue(null);
      const request = new Request('https://tcn.example/api/auth/login', {
        method: 'POST',
        headers: {
          origin: 'https://tcn.example',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: 'editor',
          password: 'secret',
          'cf-turnstile-response': 'form-token',
        }),
      });

      await POST!(context(request));

      expect(requireLoginChallenge).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'form-token', remoteIp: null }),
      );
    });

    it('stops before any D1, lock or password work when the challenge fails', async () => {
      requireLoginChallenge.mockRejectedValue(new TurnstileError('turnstile_failed'));

      const response = await POST!(context());

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ ok: false, error: 'turnstile_failed' });
      expect(getLoginRateLimitKeys).not.toHaveBeenCalled();
      expect(getLoginLockSeconds).not.toHaveBeenCalled();
      expect(getUserByUsername).not.toHaveBeenCalled();
      expect(verifyPassword).not.toHaveBeenCalled();
      // 챌린지 실패는 비밀번호 실패가 아니다 — 가짜 시도가 실제 계정의 락을 키우지 못한다.
      expect(recordLoginFailure).not.toHaveBeenCalled();
    });

    it('answers 503 when the challenge is not configured', async () => {
      requireLoginChallenge.mockRejectedValue(new TurnstileError('security_not_configured'));

      const response = await POST!(context());

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, error: 'security_not_configured' });
    });

    it('does not hide unexpected failures', async () => {
      requireLoginChallenge.mockRejectedValue(new Error('boom'));

      await expect(POST!(context())).rejects.toThrow('boom');
    });

    it('treats non-string credentials as missing instead of turning them into text', async () => {
      for (const body of [
        { username: { a: 1 }, password: 'secret' },
        { username: 'editor', password: ['secret'] },
        { username: 12_345, password: 'secret' },
      ]) {
        const request = new Request('https://tcn.example/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
          body: JSON.stringify({ ...body, turnstileToken: 'turnstile-token' }),
        });

        const response = await POST!(context(request));

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({ ok: false, error: 'missing_credentials' });
      }
      expect(requireLoginChallenge).not.toHaveBeenCalled();
      expect(getUserByUsername).not.toHaveBeenCalled();
    });

    it('does not turn a non-string challenge token into text either', async () => {
      requireLoginChallenge.mockRejectedValue(new TurnstileError('turnstile_failed'));
      const request = new Request('https://tcn.example/api/auth/login', {
        method: 'POST',
        headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'editor', password: 'secret', turnstileToken: { x: 1 } }),
      });

      await POST!(context(request));

      expect(requireLoginChallenge).toHaveBeenCalledWith(expect.objectContaining({ token: '' }));
    });

    it('rejects missing credentials before spending a Siteverify call', async () => {
      const request = new Request('https://tcn.example/api/auth/login', {
        method: 'POST',
        headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
        body: JSON.stringify({ turnstileToken: 'turnstile-token' }),
      });

      const response = await POST!(context(request));

      expect(response.status).toBe(400);
      expect(requireLoginChallenge).not.toHaveBeenCalled();
    });
  });

  it('returns 429 with the remaining lock time before any password work', async () => {
    getLoginLockSeconds.mockResolvedValue(3_600);

    const response = await POST!(context());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('3600');
    expect(getUserByUsername).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('answers 401 and records the failure when the credentials are wrong', async () => {
    getUserByUsername.mockResolvedValue({ id: 'user-1', passwordHash: 'hash' });
    verifyPassword.mockResolvedValue(false);

    const response = await POST!(context());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'invalid_credentials' });
    expect(recordLoginFailure).toHaveBeenCalledWith({}, ['account:key', 'ip:key'], undefined, {
      strict: false,
    });
  });

  it('does the same password work for an unknown username so timing cannot reveal it', async () => {
    getUserByUsername.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);

    const response = await POST!(context());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'invalid_credentials' });
    expect(verifyPassword).toHaveBeenCalledWith('secret', 'dummy-hash');
    expect(recordLoginFailure).toHaveBeenCalled();
  });

  it('answers 429 with the new lock time on the failure that earns the lock', async () => {
    getUserByUsername.mockResolvedValue({ id: 'user-1', passwordHash: 'hash' });
    verifyPassword.mockResolvedValue(false);
    recordLoginFailure.mockResolvedValue(900);

    const response = await POST!(context());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('900');
  });

  it('clears failures and embeds the current session version after success', async () => {
    getUserByUsername.mockResolvedValue({
      id: 'user-1',
      username: 'editor',
      displayName: 'Editor',
      passwordHash: 'hash',
      sessionVersion: 7,
    });
    verifyPassword.mockResolvedValue(true);

    const response = await POST!(context());

    expect(response.status).toBe(200);
    expect(clearLoginFailures).toHaveBeenCalledWith({}, ['ip:key']);
    expect(resetLoginAttempts).toHaveBeenCalledWith({}, ['account:key']);
    expect(createSessionToken).toHaveBeenCalledWith('user-1', 'secret', { sessionVersion: 7 });
  });

  describe('trusted device', () => {
    const user = {
      id: 'user-1',
      username: 'editor',
      displayName: 'Editor',
      passwordHash: 'hash',
      sessionVersion: 7,
    };

    // 계정 키가 잠겨 있으면(공격자가 일부러 걸었다고 가정) 그 키를 보는 요청만 막힌다.
    function accountKeyIsLocked() {
      getLoginLockSeconds.mockImplementation((_db: unknown, keys: string[]) =>
        Promise.resolve(keys.includes('account:key') ? 3_600 : 0),
      );
    }

    it('checks the device token against the attempted account with the session secret', async () => {
      readDeviceToken.mockReturnValue('cookie-value');
      getUserByUsername.mockResolvedValue(null);

      await POST!(context());

      expect(verifyDeviceToken).toHaveBeenCalledWith('cookie-value', 'account:key', 'secret');
    });

    it('locks out an unknown browser while the account is locked', async () => {
      accountKeyIsLocked();

      const response = await POST!(context());

      expect(response.status).toBe(429);
      expect(getLoginLockSeconds).toHaveBeenCalledWith({}, ['account:key', 'ip:key']);
    });

    it('lets a trusted device through an account lock an attacker set on purpose', async () => {
      accountKeyIsLocked();
      verifyDeviceToken.mockResolvedValue({ deviceId: 'd1' });
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(true);

      const response = await POST!(context());

      expect(response.status).toBe(200);
      expect(getLoginLockSeconds).toHaveBeenCalledWith({}, ['device:key', 'ip:key']);
    });

    it('counts a trusted device failure against the device, not the account', async () => {
      verifyDeviceToken.mockResolvedValue({ deviceId: 'd1' });
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(false);

      const response = await POST!(context());

      expect(response.status).toBe(401);
      expect(recordLoginFailure).toHaveBeenCalledWith({}, ['device:key', 'ip:key'], undefined, {
        strict: false,
      });
    });

    it('still locks a trusted device that keeps failing', async () => {
      verifyDeviceToken.mockResolvedValue({ deviceId: 'd1' });
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(false);
      recordLoginFailure.mockResolvedValue(900);

      const response = await POST!(context());

      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('900');
    });

    it('issues a device cookie for a new browser and clears the account and IP counters', async () => {
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(true);

      const response = await POST!(context());

      expect(createDeviceToken).toHaveBeenCalledWith('account:key', 'secret', {
        deviceId: undefined,
      });
      expect(clearLoginFailures).toHaveBeenCalledWith({}, ['ip:key']);
      expect(resetLoginAttempts).toHaveBeenCalledWith({}, ['account:key']);
      expect(response.headers.getSetCookie()).toEqual([
        'tcn_session=token',
        'tcn_device=device-token',
      ]);
    });

    it('leaves the account row alone after a trusted-device success so an attacker keeps the lock level', async () => {
      verifyDeviceToken.mockResolvedValue({ deviceId: 'd1' });
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(true);

      await POST!(context());

      expect(clearLoginFailures).toHaveBeenCalledWith({}, ['ip:key', 'device:key']);
      expect(resetLoginAttempts).not.toHaveBeenCalled();
    });

    it('keeps the device id of a trusted browser and clears its device counter too', async () => {
      verifyDeviceToken.mockResolvedValue({ deviceId: 'd1' });
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(true);

      await POST!(context());

      expect(createDeviceToken).toHaveBeenCalledWith('account:key', 'secret', { deviceId: 'd1' });
    });

    it('sets no device cookie when the sign-in fails', async () => {
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(false);

      const response = await POST!(context());

      expect(createDeviceToken).not.toHaveBeenCalled();
      expect(response.headers.getSetCookie()).toEqual([]);
    });
  });

  describe('sign-in log and attempt limits', () => {
    const officer = {
      id: 'officer-1',
      username: 'editor',
      displayName: 'Editor',
      passwordHash: 'hash',
      sessionVersion: 1,
      role: 'officer',
      status: 'approved',
    };
    const member = { ...officer, id: 'member-1', role: 'member' };
    const eventOf = (call = 0) => recordAuthEvent.mock.calls[call][1];

    it('records a successful sign-in with the account and the request', async () => {
      getUserByUsername.mockResolvedValue(officer);
      verifyPassword.mockResolvedValue(true);

      const request = new Request('https://tcn.example/api/auth/login', {
        method: 'POST',
        headers: { origin: 'https://tcn.example', 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'editor', password: 'secret' }),
      });
      await POST!(context(request));

      expect(recordAuthEvent).toHaveBeenCalledTimes(1);
      expect(recordAuthEvent.mock.calls[0][0]).toEqual({});
      expect(eventOf()).toMatchObject({ userId: 'officer-1', event: 'login_success' });
      expect(eventOf().request).toBeInstanceOf(Request);
    });

    it('lets the write of an officer sign-in retry once and gives everyone else one attempt', async () => {
      verifyPassword.mockResolvedValue(true);
      getUserByUsername.mockResolvedValue(officer);
      await POST!(context());
      getUserByUsername.mockResolvedValue(member);
      await POST!(context());

      expect(recordAuthEvent.mock.calls[0][2]).toEqual({ attempts: 2 });
      expect(recordAuthEvent.mock.calls[1][2]).toEqual({ attempts: 1 });
    });

    it('records a wrong password on a known account and on an unknown one', async () => {
      verifyPassword.mockResolvedValue(false);
      getUserByUsername.mockResolvedValue(member);
      await POST!(context());
      getUserByUsername.mockResolvedValue(null);
      await POST!(context());

      expect(eventOf(0)).toMatchObject({ userId: 'member-1', event: 'login_failure' });
      expect(eventOf(1)).toMatchObject({ userId: null, event: 'login_failure' });
    });

    it('records the failure that earns a lock as a lock, once', async () => {
      getUserByUsername.mockResolvedValue(officer);
      verifyPassword.mockResolvedValue(false);
      recordLoginFailure.mockResolvedValue(900);

      await POST!(context());

      expect(recordAuthEvent).toHaveBeenCalledTimes(1);
      expect(eventOf()).toMatchObject({ userId: 'officer-1', event: 'login_locked' });
    });

    it('writes nothing while an attempt is turned away by an existing lock or challenge', async () => {
      getLoginLockSeconds.mockResolvedValue(3_600);
      await POST!(context());

      getLoginLockSeconds.mockResolvedValue(0);
      requireLoginChallenge.mockRejectedValue(new TurnstileError('turnstile_failed'));
      await POST!(context());

      expect(recordAuthEvent).not.toHaveBeenCalled();
    });

    it('lets a member in when the sign-in cannot be recorded, and a wrong password still answers 401', async () => {
      recordAuthEvent.mockResolvedValue(false);
      getUserByUsername.mockResolvedValue(member);
      verifyPassword.mockResolvedValue(true);
      expect((await POST!(context())).status).toBe(200);

      verifyPassword.mockResolvedValue(false);
      expect((await POST!(context())).status).toBe(401);
    });

    it('gives an approved officer no session when the sign-in cannot be recorded', async () => {
      recordAuthEvent.mockResolvedValue(false);
      getUserByUsername.mockResolvedValue(officer);
      verifyPassword.mockResolvedValue(true);

      const response = await POST!(context());

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ ok: false, error: 'auth_log_unavailable' });
      expect(response.headers.get('retry-after')).toBe('60');
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(createSessionToken).not.toHaveBeenCalled();
      expect(createDeviceToken).not.toHaveBeenCalled();
    });

    it('does not count an unrecorded officer sign-in as a wrong password, so a retry goes straight through', async () => {
      getUserByUsername.mockResolvedValue(officer);
      verifyPassword.mockResolvedValue(true);

      recordAuthEvent.mockResolvedValueOnce(false);
      expect((await POST!(context())).status).toBe(503);
      expect(recordLoginFailure).not.toHaveBeenCalled();
      expect(getLoginLockSeconds).toHaveBeenCalledTimes(1);

      const retry = await POST!(context());
      expect(retry.status).toBe(200);
      expect(getLoginLockSeconds).toHaveBeenCalledTimes(2);
      expect(recordAuthEvent).toHaveBeenCalledTimes(2);
      expect(retry.headers.getSetCookie().length).toBeGreaterThan(0);
    });

    it('still lets an officer see a wrong password or a lock when those records cannot be written', async () => {
      recordAuthEvent.mockResolvedValue(false);
      getUserByUsername.mockResolvedValue(officer);
      verifyPassword.mockResolvedValue(false);
      expect((await POST!(context())).status).toBe(401);

      recordLoginFailure.mockResolvedValue(900);
      expect((await POST!(context())).status).toBe(429);
    });

    it('gives approved officers the strict failure limit and everyone else the lenient one', async () => {
      verifyPassword.mockResolvedValue(false);
      const strictFor = async (user: unknown) => {
        recordLoginFailure.mockClear();
        getUserByUsername.mockResolvedValue(user);
        await POST!(context());
        return recordLoginFailure.mock.calls[0][3];
      };

      expect(await strictFor(officer)).toEqual({ strict: true });
      expect(await strictFor(member)).toEqual({ strict: false });
      expect(await strictFor({ ...officer, status: 'rejected' })).toEqual({ strict: false });
      expect(await strictFor(null)).toEqual({ strict: false });
    });
  });

  describe('housekeeping and lock logging', () => {
    const user = { id: 'user-1', passwordHash: 'hash', sessionVersion: 1 };

    afterEach(() => {
      vi.restoreAllMocks();
      vi.useRealTimers();
    });

    it('prunes stale rate-limit rows after every successful sign-in', async () => {
      getUserByUsername.mockResolvedValue({ ...user, username: 'editor', displayName: 'Editor' });
      verifyPassword.mockResolvedValue(true);

      await POST!(context());

      expect(pruneLoginRateLimits).toHaveBeenCalledWith({});
    });

    it('prunes during one second in fifty so an attack cannot grow the table unbounded', async () => {
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(false);
      vi.useFakeTimers({ toFake: ['Date'] });

      vi.setSystemTime(100_000); // 100 s, a multiple of 50
      await POST!(context());
      expect(pruneLoginRateLimits).toHaveBeenCalledTimes(1);

      pruneLoginRateLimits.mockClear();
      vi.setSystemTime(101_000);
      await POST!(context());
      expect(pruneLoginRateLimits).not.toHaveBeenCalled();
    });

    it('logs a structured event when a failure earns a lock, without the username or IP', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(false);
      recordLoginFailure.mockResolvedValue(900);

      await POST!(context());

      expect(warn).toHaveBeenCalledOnce();
      const [message] = warn.mock.calls[0] as [string];
      expect(JSON.parse(message)).toEqual({
        event: 'login_locked',
        retryAfter: 900,
        trustedDevice: false,
        account: 'account:key',
      });
      expect(message).not.toContain('editor');
      expect(message).not.toContain('203.0.113.10');
    });

    it('stays quiet for an ordinary wrong password', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      getUserByUsername.mockResolvedValue(user);
      verifyPassword.mockResolvedValue(false);

      await POST!(context());

      expect(warn).not.toHaveBeenCalled();
    });
  });
});
