import type { APIRoute } from 'astro';
import { getDB, getUserByUsername } from '../../../lib/db';
import { buildSessionCookie, createSessionToken, getSessionSecret, verifyPassword } from '../../../lib/auth';
import {
  clearLoginFailures,
  getLoginRateLimitKeys,
  isLoginRateLimited,
  LOGIN_RETRY_AFTER_SECONDS,
  recordLoginFailure,
} from '../../../lib/auth/rate-limit';

export const prerender = false;

async function readCredentials(request: Request): Promise<{ username: string; password: string }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as { username?: unknown; password?: unknown };
    return { username: String(body.username ?? ''), password: String(body.password ?? '') };
  }
  const form = await request.formData().catch(() => new FormData());
  return { username: String(form.get('username') ?? ''), password: String(form.get('password') ?? '') };
}

export const POST: APIRoute = async ({ request, url }) => {
  const { username, password } = await readCredentials(request);
  if (!username || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  const db = getDB();
  const rateLimitKeys = await getLoginRateLimitKeys(request, username);
  if (await isLoginRateLimited(db, rateLimitKeys)) {
    return Response.json(
      { ok: false, error: 'rate_limited' },
      { status: 429, headers: { 'retry-after': String(LOGIN_RETRY_AFTER_SECONDS) } },
    );
  }

  const user = await getUserByUsername(db, username);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    const blocked = await recordLoginFailure(db, rateLimitKeys);
    if (blocked) {
      return Response.json(
        { ok: false, error: 'rate_limited' },
        { status: 429, headers: { 'retry-after': String(LOGIN_RETRY_AFTER_SECONDS) } },
      );
    }
    // 동일 응답으로 사용자 존재 여부 누설 방지.
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  await clearLoginFailures(db, rateLimitKeys);
  const token = await createSessionToken(user.id, getSessionSecret(), {
    sessionVersion: user.sessionVersion,
  });
  return new Response(
    JSON.stringify({ ok: true, user: { id: user.id, username: user.username, displayName: user.displayName } }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': buildSessionCookie(token, { secure: url.protocol === 'https:' }),
      },
    },
  );
};
