export function clearAccountCookies(headers: Headers, secure: boolean) {
  for (const [name, path] of [
    ['tcn_session', '/'],
    ['tcn_device', '/api/auth/login'],
    ['tcn_signup', '/'],
  ]) {
    headers.append(
      'set-cookie',
      `${name}=; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? '; Secure' : ''}`,
    );
  }
}
