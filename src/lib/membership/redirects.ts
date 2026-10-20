// Keep this pure: used by both the login API and server-rendered pages.
export function safeMemberReturnTo(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\u0000-\u0020\u007f]/.test(value)
  )
    return null;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\\\u0000-\u0020\u007f]/.test(decoded) || /%2f|%5c|%25/i.test(value)) return null;
    const url = new URL(value, 'https://tcn.invalid');
    const decodedPath = new URL(decodeURIComponent(url.pathname), 'https://tcn.invalid').pathname;
    if (url.origin !== 'https://tcn.invalid') return null;
    if (decodedPath === '/admin/login' || decodedPath.startsWith('/admin/login/')) return null;
    if (
      !['/admin', '/forum', '/account'].some(
        (root) => url.pathname === root || url.pathname.startsWith(`${root}/`),
      )
    )
      return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

export function defaultMemberDestination(user: { role: string; status: string }): string {
  if (user.status === 'rejected') return '/account';
  if (user.role === 'officer' && user.status === 'approved') return '/admin';
  return '/forum/assembly';
}
