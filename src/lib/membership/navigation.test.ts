import { describe, expect, it } from 'vitest';
import { memberNavigation } from './navigation';
describe('member capability navigation', () => {
  it('hides member links when the runtime gate is off or unknown', () => {
    expect(memberNavigation({ authenticated: true, capabilities: { manageUsers: true } })).toEqual(
      [],
    );
    expect(memberNavigation({ memberFeaturesEnabled: false, authenticated: true })).toEqual([]);
  });
  it('hides member links from anonymous visitors even when enabled', () => {
    expect(memberNavigation({ memberFeaturesEnabled: true, authenticated: false })).toEqual([]);
  });
  it('keeps rejected accounts reachable and uses only explicit capabilities for privileged links', () => {
    expect(
      memberNavigation({ memberFeaturesEnabled: true, authenticated: true, capabilities: {} }),
    ).toEqual([{ href: '/account', label: 'Account' }]);
    expect(
      memberNavigation({
        memberFeaturesEnabled: true,
        authenticated: true,
        capabilities: {
          directorsForum: true,
          assemblyForum: true,
          manageUsers: true,
          manageContent: true,
        },
      }).map((link) => link.href),
    ).toEqual(['/account', '/forum/assembly', '/forum/directors', '/admin', '/admin/users']);
  });
});
