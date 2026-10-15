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

// 이름이 정확히 같은 쿠키 하나를 읽는다. 값이 비었거나 퍼센트 인코딩이 깨졌으면 null —
// 깨진 쿠키를 보낸 요청이 예외로 500 을 만들지 않게 한다.
export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    const raw = part.slice(separator + 1).trim();
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}

export function readSessionToken(request: Request): string | null {
  return readCookie(request, SESSION_COOKIE);
}
