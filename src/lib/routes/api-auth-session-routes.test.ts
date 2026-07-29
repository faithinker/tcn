import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearSessionCookie, getDB, getSessionUid, getUserById, revokeUserSessions } = vi.hoisted(
  () => ({
    clearSessionCookie: vi.fn(({ secure }: { secure: boolean }) =>
      secure ? 'expired; Secure' : 'expired',
    ),
    getDB: vi.fn(() => ({})),
    getSessionUid: vi.fn(),
    getUserById: vi.fn(),
    revokeUserSessions: vi.fn(),
  }),
);

vi.mock('../auth', () => ({ clearSessionCookie, getSessionUid }));
vi.mock('../db', () => ({ getDB, getUserById, revokeUserSessions }));

import { POST as logout } from '../../pages/api/auth/logout';
import { GET as me } from '../../pages/api/auth/me';

function context(path: string, protocol = 'https:') {
  const url = new URL(`${protocol}//tcn.example${path}`);
  return {
    request: new Request(url),
    url,
  } as unknown as Parameters<NonNullable<typeof logout>>[0];
}

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('user-1');
    revokeUserSessions.mockResolvedValue(undefined);
  });

  it('revokes all existing tokens before expiring the HTTPS cookie', async () => {
    const response = await logout!(context('/api/auth/logout'));

    expect(response.status).toBe(200);
    expect(revokeUserSessions).toHaveBeenCalledWith(expect.anything(), 'user-1');
    expect(clearSessionCookie).toHaveBeenCalledWith({ secure: true });
    expect(response.headers.get('set-cookie')).toBe('expired; Secure');
  });

  it('still clears the local cookie when no valid session remains', async () => {
    getSessionUid.mockResolvedValue(null);

    const response = await logout!(context('/api/auth/logout', 'http:'));

    expect(response.status).toBe(200);
    expect(revokeUserSessions).not.toHaveBeenCalled();
    expect(clearSessionCookie).toHaveBeenCalledWith({ secure: false });
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('user-1');
    getUserById.mockResolvedValue({
      id: 'user-1',
      username: 'editor',
      displayName: 'TCN Editor',
      passwordHash: 'must-not-leak',
    });
  });

  it('returns only the public administrator identity fields', async () => {
    const response = await me!(context('/api/auth/me'));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      authenticated: true,
      user: { id: 'user-1', username: 'editor', displayName: 'TCN Editor' },
    });
  });

  it('treats a missing session or deleted user as unauthenticated', async () => {
    getSessionUid.mockResolvedValue(null);
    await expect((await me!(context('/api/auth/me'))).json()).resolves.toEqual({
      ok: true,
      authenticated: false,
    });
    expect(getUserById).not.toHaveBeenCalled();

    getSessionUid.mockResolvedValue('deleted-user');
    getUserById.mockResolvedValue(null);
    await expect((await me!(context('/api/auth/me'))).json()).resolves.toEqual({
      ok: true,
      authenticated: false,
    });
  });
});
