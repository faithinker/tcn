import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  buildSessionCookie,
  clearLoginFailures,
  createSessionToken,
  getDB,
  getLoginRateLimitKeys,
  getSessionSecret,
  getUserByUsername,
  isLoginRateLimited,
  recordLoginFailure,
  verifyPassword,
} = vi.hoisted(() => ({
  buildSessionCookie: vi.fn(() => 'tcn_session=token'),
  clearLoginFailures: vi.fn(),
  createSessionToken: vi.fn(() => 'token'),
  getDB: vi.fn(() => ({})),
  getLoginRateLimitKeys: vi.fn(() => Promise.resolve(['account:key', 'ip:key'])),
  getSessionSecret: vi.fn(() => 'secret'),
  getUserByUsername: vi.fn(),
  isLoginRateLimited: vi.fn(),
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
  getLoginRateLimitKeys,
  isLoginRateLimited,
  LOGIN_RETRY_AFTER_SECONDS: 900,
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
    isLoginRateLimited.mockResolvedValue(false);
    recordLoginFailure.mockResolvedValue(false);
    clearLoginFailures.mockResolvedValue(undefined);
  });

  it('returns 429 before password work when an account or IP is blocked', async () => {
    isLoginRateLimited.mockResolvedValue(true);

    const response = await POST!(context());

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('900');
    expect(getUserByUsername).not.toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('records failed credentials and blocks the threshold attempt', async () => {
    getUserByUsername.mockResolvedValue({ id: 'user-1', passwordHash: 'hash' });
    verifyPassword.mockResolvedValue(false);
    recordLoginFailure.mockResolvedValue(true);

    const response = await POST!(context());

    expect(response.status).toBe(429);
    expect(recordLoginFailure).toHaveBeenCalled();
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
    expect(clearLoginFailures).toHaveBeenCalled();
    expect(createSessionToken).toHaveBeenCalledWith('user-1', 'secret', { sessionVersion: 7 });
  });
});
