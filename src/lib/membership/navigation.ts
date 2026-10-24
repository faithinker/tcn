export interface MemberSession {
  memberFeaturesEnabled?: boolean;
  authenticated?: boolean;
  capabilities?: Partial<
    Record<'assemblyForum' | 'directorsForum' | 'manageUsers' | 'manageContent', boolean>
  >;
}
export function memberNavigation(session: MemberSession): { href: string; label: string }[] {
  if (session.memberFeaturesEnabled !== true) return [];
  if (session.authenticated !== true) return [];
  const links = [{ href: '/account', label: 'Account' }];
  const capabilities = session.capabilities ?? {};
  if (capabilities.assemblyForum === true)
    links.push({ href: '/forum/assembly', label: 'General Assembly forum' });
  if (capabilities.directorsForum === true)
    links.push({ href: '/forum/directors', label: 'Board of Directors forum' });
  if (capabilities.manageContent === true) links.push({ href: '/admin', label: 'Manage content' });
  if (capabilities.manageUsers === true)
    links.push({ href: '/admin/users', label: 'Manage users' });
  return links;
}
