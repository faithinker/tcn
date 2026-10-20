import { beforeEach, describe, expect, it, vi } from 'vitest';

const { clearSessionCookie, getDB, getSessionUid, getSessionUser, revokeUserSessions } = vi.hoisted(
  () => ({
    clearSessionCookie: vi.fn(({ secure }: { secure: boolean }) =>
      secure ? 'expired; Secure' : 'expired',
    ),
    getDB: vi.fn(() => ({})),
    getSessionUid: vi.fn(),
    getSessionUser: vi.fn(),
    revokeUserSessions: vi.fn(),
  }),
);

vi.mock('../auth', () => ({ clearSessionCookie, getSessionUid, getSessionUser }));
vi.mock('../db', () => ({ getDB, revokeUserSessions }));

import { POST as logout } from '../../pages/api/auth/logout';
import { GET as me } from '../../pages/api/auth/me';

vi.mock('../member-features', () => ({ memberFeaturesEnabled: () => true }));

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
    getSessionUser.mockResolvedValue({
      id: 'user-1',
      username: 'editor',
      displayName: 'TCN Editor',
      role: 'officer',
      status: 'approved',
      isExecutive: true,
    });
  });

  it('returns the identity fields plus role and status, never the executive flag', async () => {
    const response = await me!(context('/api/auth/me'));

    await expect(response.json()).resolves.toEqual({
      ok: true,
      authenticated: true,
      memberFeaturesEnabled: true,
      capabilities: {
        directorsForum: true,
        assemblyForum: true,
        manageUsers: true,
        manageContent: true,
      },
      user: {
        id: 'user-1',
        username: 'editor',
        displayName: 'TCN Editor',
        role: 'officer',
        status: 'approved',
      },
    });
  });

  it('reports pending and rejected accounts as authenticated with their status', async () => {
    getSessionUser.mockResolvedValue({
      id: 'user-2',
      username: 'new@example.org',
      displayName: null,
      role: 'member',
      status: 'pending',
      isExecutive: false,
    });

    const body = await (await me!(context('/api/auth/me'))).json();

    expect(body).toMatchObject({
      authenticated: true,
      user: { role: 'member', status: 'pending' },
    });
  });

  it('treats a missing session or deleted user as unauthenticated', async () => {
    getSessionUser.mockResolvedValue(null);

    await expect((await me!(context('/api/auth/me'))).json()).resolves.toEqual({
      ok: true,
      authenticated: false,
      memberFeaturesEnabled: true,
    });
  });
});
