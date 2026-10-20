import { describe, expect, it } from 'vitest';
import { defaultMemberDestination, safeMemberReturnTo } from './redirects';

describe('member login destinations', () => {
  it('preserves encoded query data without turning it into URL syntax', () => {
    expect(safeMemberReturnTo('/admin/users?search=A%26B')).toBe('/admin/users?search=A%26B');
  });
  it.each(['/admin', '/admin/users?status=pending', '/forum/assembly', '/account'])(
    'accepts %s',
    (path) => {
      expect(safeMemberReturnTo(path)).toBe(path);
    },
  );
  it.each([
    null,
    '',
    '//evil.org/admin',
    'https://evil.org',
    '/admin\\evil',
    '/administrator',
    '/forum/%5c%5cevil.org',
    '/account/%2f%2fevil',
    '/admin/login',
    '/login',
    '/account/../login',
    '/forum\n/assembly',
  ])('rejects %j', (path) => {
    expect(safeMemberReturnTo(path)).toBeNull();
  });
  it('uses account status before role when choosing a default', () => {
    expect(defaultMemberDestination({ role: 'officer', status: 'rejected' })).toBe('/account');
    expect(defaultMemberDestination({ role: 'officer', status: 'pending' })).toBe(
      '/forum/assembly',
    );
    expect(defaultMemberDestination({ role: 'officer', status: 'approved' })).toBe('/admin');
    expect(defaultMemberDestination({ role: 'member', status: 'approved' })).toBe(
      '/forum/assembly',
    );
  });
  it.each(['/admin/%6cogin', '/admin/login%2f', '/account/%2e%2e/admin/login'])(
    'rejects encoded login-loop destinations %s',
    (path) => {
      expect(safeMemberReturnTo(path)).toBeNull();
    },
  );
});

// The server must reject destinations the user can no longer access.
import { memberDestination } from './redirects';
it('falls back when approval or board access changed before login', () => {
  const base = {
    id: 'member',
    username: 'member',
    displayName: 'Member',
    role: 'member' as const,
    status: 'rejected' as const,
    isExecutive: false,
    canAccessDirectorsForum: false,
  };
  expect(memberDestination(base, '/forum/assembly')).toBe('/account');
  expect(memberDestination({ ...base, status: 'pending' }, '/admin')).toBe('/forum/assembly');
  expect(memberDestination({ ...base, status: 'approved' }, '/forum/directors')).toBe(
    '/forum/assembly',
  );
  expect(memberDestination({ ...base, status: 'approved' }, '/account')).toBe('/account');
});
