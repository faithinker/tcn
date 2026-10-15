import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildSessionCookie,
  clearLoginFailures,
  createSessionToken,
  getDB,
  getLoginLockSeconds,
  getLoginRateLimitKeys,
  getSessionSecret,
  getUserByUsername,
  recordLoginFailure,
  verifyPassword,
} = vi.hoisted(() => ({
  buildSessionCookie: vi.fn(() => 'tcn_session=token'),
  clearLoginFailures: vi.fn(),
  createSessionToken: vi.fn(() => 'token'),
  getDB: vi.fn(() => ({})),
  getLoginLockSeconds: vi.fn(),
  getLoginRateLimitKeys: vi.fn(() => Promise.resolve(['account:key', 'ip:key'])),
  getSessionSecret: vi.fn(() => 'secret'),
  getUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock('../auth', () => ({
  buildSessionCookie,
  createSessionToken,
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

function context() {
  return {
    request: new Request('https://tcn.example/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cf-connecting-ip': '203.0.113.10',
      },
      body: JSON.stringify({ username: 'editor', password: 'secret' }),
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
