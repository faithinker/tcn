import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionUser } = vi.hoisted(() => ({ getSessionUser: vi.fn() }));

vi.mock('./guard', () => ({ getSessionUser }));

import {
  requireActiveAccount,
  requireActiveAccountPage,
  requireExecutive,
  requireExecutivePage,
  requireOfficer,
  requireOfficerPage,
} from './require';
import type { SessionUser } from './permissions';

function account(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'u1',
    username: 'u1@example.org',
    displayName: 'U1',
    role: 'member',
    status: 'approved',
    isExecutive: false,
    canAccessDirectorsForum: false,
    ...overrides,
  };
}

const request = new Request('https://tcn.example/admin');
const context = { request };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('API guards', () => {
  it('answers 401 unauthorized when there is no valid session', async () => {
    getSessionUser.mockResolvedValue(null);
    const result = await requireOfficer(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    await expect(result.response.json()).resolves.toEqual({ ok: false, error: 'unauthorized' });
  });

  it.each([
    ['a member', account()],
    ['a pending officer', account({ role: 'officer', status: 'pending' })],
    ['a rejected officer', account({ role: 'officer', status: 'rejected' })],
  ])('answers 403 forbidden to %s on an officer route', async (_label, user) => {
    getSessionUser.mockResolvedValue(user);
    const result = await requireOfficer(request);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    await expect(result.response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
  });

  it('lets an approved officer through and returns the user', async () => {
    const officer = account({ role: 'officer' });
    getSessionUser.mockResolvedValue(officer);
    await expect(requireOfficer(request)).resolves.toEqual({ ok: true, user: officer });
  });

  it('keeps an officer without the executive flag out of executive routes', async () => {
    getSessionUser.mockResolvedValue(account({ role: 'officer' }));
    const result = await requireExecutive(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);

    getSessionUser.mockResolvedValue(account({ role: 'officer', isExecutive: true }));
    expect((await requireExecutive(request)).ok).toBe(true);
  });

  it('lets pending accounts use active-account routes but not rejected ones', async () => {
    getSessionUser.mockResolvedValue(account({ status: 'pending' }));
    expect((await requireActiveAccount(request)).ok).toBe(true);

    getSessionUser.mockResolvedValue(account({ status: 'rejected' }));
    const result = await requireActiveAccount(request);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });
});

describe('page guards', () => {
  it('redirects a visitor without a session to the default login page', async () => {
    getSessionUser.mockResolvedValue(null);
    const result = await requireOfficerPage(context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get('location')).toBe('/admin/login');
  });

  it('keeps the caller-provided login URL so returnTo survives', async () => {
    getSessionUser.mockResolvedValue(null);
    const loginUrl = '/admin/login?returnTo=%2Fadmin%2Fquestions';
    const result = await requireOfficerPage(context, { loginUrl });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.headers.get('location')).toBe(loginUrl);
  });

  it('answers a plain-text 403 that is never cached', async () => {
    getSessionUser.mockResolvedValue(account());
    const result = await requireOfficerPage(context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
    expect(result.response.headers.get('content-type')).toContain('text/plain');
    expect(result.response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns the user for qualifying accounts on every page guard', async () => {
    const executive = account({ role: 'officer', isExecutive: true });
    getSessionUser.mockResolvedValue(executive);
    await expect(requireOfficerPage(context)).resolves.toEqual({ ok: true, user: executive });
    await expect(requireExecutivePage(context)).resolves.toEqual({ ok: true, user: executive });
    await expect(requireActiveAccountPage(context)).resolves.toEqual({ ok: true, user: executive });
  });
});
