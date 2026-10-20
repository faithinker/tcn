import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyPassword } from '../auth/password';
import { openTestD1 } from '../../test-support/d1';

const { flags, getDB, getUserByUsername, run, bind, createSessionToken, buildSessionCookie } =
  vi.hoisted(() => {
    const run = vi.fn();
    const bind = vi.fn(() => ({ run }));
    return {
      flags: { members: true, signup: true },
      getDB: vi.fn(() => ({ prepare: vi.fn(() => ({ bind })) })),
      getUserByUsername: vi.fn(),
      run,
      bind,
      createSessionToken: vi.fn(() => 'session-token'),
      buildSessionCookie: vi.fn(() => 'tcn_session=session-token; HttpOnly; Secure; SameSite=Lax'),
    };
  });
vi.mock('../member-features', () => ({
  memberFeaturesEnabled: () => flags.members,
  signupEnabled: () => flags.signup,
  memberFeatureUnavailable: () => new Response(null, { status: 503 }),
}));
vi.mock('../db', () => ({ getDB, getUserByUsername, newId: () => 'new-user' }));
vi.mock('cloudflare:workers', () => ({ env: {} }));
vi.mock('../auth', async () => ({
  ...(await import('../auth/password')),
  createSessionToken,
  buildSessionCookie,
  getSessionSecret: () => 'secret',
}));
import { POST } from '../../pages/api/auth/signup';

const input = {
  email: ' New@Example.org ',
  password: 'Some rivers carry ancient stories',
  displayName: ' New Member ',
  affiliation: 'Institute',
};
function context(
  body: unknown = input,
  origin: string | null = 'https://tcn.example',
  extraHeaders = {},
) {
  const url = new URL('https://tcn.example/api/auth/signup');
  return {
    url,
    request: new Request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(origin ? { origin } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<typeof POST>[0];
}
describe('signup route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.members = flags.signup = true;
    getUserByUsername.mockResolvedValue(null);
    run.mockResolvedValue({ success: true });
  });
  it('returns 404 before touching storage while signup is off', async () => {
    flags.signup = false;
    expect((await POST(context())).status).toBe(404);
    expect(getDB).not.toHaveBeenCalled();
  });
  it('returns 503 while member features are off', async () => {
    flags.members = false;
    expect((await POST(context())).status).toBe(503);
    expect(getDB).not.toHaveBeenCalled();
  });
  it.each([null, 'https://evil.org'])('rejects origin %j', async (origin) => {
    expect((await POST(context(input, origin))).status).toBe(403);
    expect(getDB).not.toHaveBeenCalled();
  });
  it('rejects cross-site metadata and unsupported payloads', async () => {
    expect((await POST(context(input, undefined, { 'sec-fetch-site': 'cross-site' }))).status).toBe(
      403,
    );
    expect((await POST(context(input, undefined, { 'content-type': 'text/plain' }))).status).toBe(
      415,
    );
    expect((await POST(context({ ...input, affiliation: 'x'.repeat(9000) }))).status).toBe(413);
  });
  it('rejects privilege injection before hashing or storage', async () => {
    expect((await POST(context({ ...input, role: 'officer' }))).status).toBe(400);
    expect(getDB).not.toHaveBeenCalled();
  });
  it('rejects duplicate email and uniqueness races without issuing a session', async () => {
    getUserByUsername.mockResolvedValueOnce({ id: 'existing' });
    expect((await POST(context())).status).toBe(409);
    run.mockRejectedValueOnce(new Error('D1_ERROR: UNIQUE constraint failed: users.username'));
    expect((await POST(context())).status).toBe(409);
    expect(createSessionToken).not.toHaveBeenCalled();
  });
  it('persists a normalized pending member with no elevated privileges and logs in', async () => {
    const response = await POST(context());
    expect(response.status).toBe(201);
    expect(getUserByUsername).toHaveBeenCalledWith(expect.anything(), 'new@example.org');
    const values = bind.mock.calls[0] as unknown as [string, string, string, string, string];
    expect(values.slice(0, 2)).toEqual(['new-user', 'new@example.org']);
    expect(await verifyPassword(input.password, values[2])).toBe(true);
    expect(values.slice(3)).toEqual(['New Member', 'Institute']);
    const db = getDB.mock.results[0].value;
    expect(db.prepare.mock.calls[0][0]).toMatch(/'member',\s*'pending',\s*0,\s*0/);
    expect(createSessionToken).toHaveBeenCalledWith('new-user', 'secret', { sessionVersion: 1 });
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(await response.json()).toEqual({ ok: true, redirectTo: '/account' });
  });
  it('creates a usable session matching the actual migrated database version', async () => {
    const fixture = await openTestD1();
    try {
      getDB.mockReturnValueOnce(fixture.db as unknown as ReturnType<typeof getDB>);
      const response = await POST(context());
      expect(response.status).toBe(201);
      const row = await fixture.db
        .prepare(
          'select role, status, is_executive, can_access_directors_forum, session_version, affiliation from users where id = ?1',
        )
        .bind('new-user')
        .first();
      expect(row).toEqual({
        role: 'member',
        status: 'pending',
        is_executive: 0,
        can_access_directors_forum: 0,
        session_version: 1,
        affiliation: 'Institute',
      });
      expect(createSessionToken).toHaveBeenCalledWith('new-user', 'secret', { sessionVersion: 1 });
    } finally {
      await fixture.dispose();
    }
  });
});
