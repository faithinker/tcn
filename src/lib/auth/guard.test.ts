import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env, getDB, getUserById } = vi.hoisted(() => ({
  env: { SESSION_SECRET: 'test-secret' },
  getDB: vi.fn(() => ({})),
  getUserById: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../db', () => ({ getDB, getUserById }));

import { SESSION_COOKIE } from './cookie';
import { getSessionUid, getSessionUser } from './guard';
import { createSessionToken } from './session';

describe('getSessionUid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a token only while its user session version matches', async () => {
    const token = await createSessionToken('user-1', env.SESSION_SECRET, { sessionVersion: 4 });
    getUserById.mockResolvedValue({ id: 'user-1', sessionVersion: 4 });
    const request = new Request('https://tcn.example/admin', {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });

    await expect(getSessionUid(request)).resolves.toBe('user-1');
  });

  it('rejects tokens revoked by logout or an account session reset', async () => {
    const token = await createSessionToken('user-1', env.SESSION_SECRET, { sessionVersion: 3 });
    getUserById.mockResolvedValue({ id: 'user-1', sessionVersion: 4 });
    const request = new Request('https://tcn.example/admin', {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });

    await expect(getSessionUid(request)).resolves.toBeNull();
  });
});

describe('getSessionUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function requestWith(token: string) {
    return new Request('https://tcn.example/admin', {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    });
  }

  it('returns the public session user without secret fields', async () => {
    const token = await createSessionToken('user-1', env.SESSION_SECRET, { sessionVersion: 4 });
    getUserById.mockResolvedValue({
      id: 'user-1',
      username: 'editor',
      displayName: 'Editor',
      passwordHash: 'must-not-leak',
      sessionVersion: 4,
      createdAt: 1,
      role: 'officer',
      status: 'approved',
      isExecutive: true,
    });

    await expect(getSessionUser(requestWith(token))).resolves.toEqual({
      id: 'user-1',
      username: 'editor',
      displayName: 'Editor',
      role: 'officer',
      status: 'approved',
      isExecutive: true,
    });
  });

  it('treats a revoked session version like getSessionUid does', async () => {
    const token = await createSessionToken('user-1', env.SESSION_SECRET, { sessionVersion: 3 });
    getUserById.mockResolvedValue({ id: 'user-1', sessionVersion: 4 });

    await expect(getSessionUser(requestWith(token))).resolves.toBeNull();
    await expect(getSessionUid(requestWith(token))).resolves.toBeNull();
  });

  it('treats a deleted account as unauthenticated', async () => {
    const token = await createSessionToken('gone', env.SESSION_SECRET, { sessionVersion: 1 });
    getUserById.mockResolvedValue(null);

    await expect(getSessionUser(requestWith(token))).resolves.toBeNull();
  });

  it('returns null without a session cookie', async () => {
    await expect(getSessionUser(new Request('https://tcn.example/admin'))).resolves.toBeNull();
    expect(getUserById).not.toHaveBeenCalled();
  });
});
