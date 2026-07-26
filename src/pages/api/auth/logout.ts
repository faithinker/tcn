import type { APIRoute } from 'astro';
import { clearSessionCookie, getSessionUid } from '../../../lib/auth';
import { getDB, revokeUserSessions } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const uid = await getSessionUid(request);
  if (uid) await revokeUserSessions(getDB(), uid);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': clearSessionCookie({ secure: url.protocol === 'https:' }),
    },
  });
};
