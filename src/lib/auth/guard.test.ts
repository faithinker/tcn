import { beforeEach, describe, expect, it, vi } from 'vitest';

const { env, getDB, getUserById } = vi.hoisted(() => ({
  env: { SESSION_SECRET: 'test-secret' },
  getDB: vi.fn(() => ({})),
  getUserById: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../db', () => ({ getDB, getUserById }));

import { SESSION_COOKIE } from './cookie';
import { getSessionUid } from './guard';
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
