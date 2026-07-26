import { SESSION_TTL_SECONDS } from './session';

export const SESSION_COOKIE = 'tcn_session';

// Secure 는 https 에서만(로컬 http dev 에서는 브라우저가 Secure 쿠키를 안 보냄).
export function buildSessionCookie(token: string, opts: { secure: boolean }): string {
  const flags = ['HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${SESSION_TTL_SECONDS}`];
  if (opts.secure) flags.push('Secure');
  return `${SESSION_COOKIE}=${token}; ${flags.join('; ')}`;
}

export function clearSessionCookie(opts: { secure: boolean }): string {
  const flags = ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=0'];
  if (opts.secure) flags.push('Secure');
  return `${SESSION_COOKIE}=; ${flags.join('; ')}`;
}

export function readSessionToken(request: Request): string | null {
  const cookie = request.headers.get('cookie');
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}
