// A plain sign-out keeps the trusted-device cookie, or an attacker could lock out an administrator who logged out.
export function clearAccountCookies(
  headers: Headers,
  secure: boolean,
  options: { keepDevice?: boolean } = {},
) {
  for (const [name, path] of [
    ['tcn_session', '/'],
    ['tcn_device', '/api/auth/login'],
    ['tcn_signup', '/'],
  ]) {
    if (name === 'tcn_device' && options.keepDevice) continue;
    headers.append(
      'set-cookie',
      `${name}=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`,
    );
  }
}
