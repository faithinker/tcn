import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildSessionCookie,
  clearLoginFailures,
  createSessionToken,
  env,
  getDB,
  getLoginLockSeconds,
  getLoginRateLimitKeys,
  getSessionSecret,
  getUserByUsername,
  recordLoginFailure,
  requireLoginChallenge,
  verifyPassword,
} = vi.hoisted(() => ({
  buildSessionCookie: vi.fn(() => 'tcn_session=token'),
  clearLoginFailures: vi.fn(),
  createSessionToken: vi.fn(() => 'token'),
  env: { TURNSTILE_SECRET_KEY: 'turnstile-secret', QNA_TURNSTILE_HOSTNAMES: 'tcn.example' },
  getDB: vi.fn(() => ({})),
  getLoginLockSeconds: vi.fn(),
  getLoginRateLimitKeys: vi.fn(() => Promise.resolve(['account:key', 'ip:key'])),
  getSessionSecret: vi.fn(() => 'secret'),
  getUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  requireLoginChallenge: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../auth/login-challenge', () => ({ requireLoginChallenge }));
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
  recordLoginFailure,
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
    clearLoginFailures.mockResolvedValue(undefined);
    requireLoginChallenge.mockResolvedValue(undefined);
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
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
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

    it('rejects missing credentials before spending a Siteverify call', async () => {
      const request = new Request('https://tcn.example/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
    expect(recordLoginFailure).toHaveBeenCalledWith({}, ['account:key', 'ip:key']);
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
    expect(clearLoginFailures).toHaveBeenCalledWith({}, ['account:key', 'ip:key']);
    expect(createSessionToken).toHaveBeenCalledWith('user-1', 'secret', { sessionVersion: 7 });
  });
});
