import type { APIRoute } from 'astro';
import { recordAuthEvent } from '../../../lib/auth/auth-log';
import { getSessionUser } from '../../../lib/auth/guard';
import { requireMutation, requireSameOrigin, SecurityError } from '../../../lib/auth/mutation';
import { clearAccountCookies } from '../../../lib/account/cookies';
import { getDB, revokeUserSessions } from '../../../lib/db';
export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  try {
    requireSameOrigin(request);
    const user = await getSessionUser(request);
    if (user) {
      await requireMutation(request, { scope: 'account', require: 'signedIn' });
      const db = getDB();
      await revokeUserSessions(db, user.id);
      await recordAuthEvent(db, { userId: user.id, event: 'logout', request });
    }
    const headers = new Headers({ 'cache-control': 'no-store' });
    clearAccountCookies(headers, url.protocol === 'https:');
    return Response.json({ ok: true }, { headers });
  } catch (error) {
    if (error instanceof SecurityError)
      return Response.json({ ok: false, error: error.code }, { status: error.status });
    throw error;
  }
};
