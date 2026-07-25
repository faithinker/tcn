import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { getDB, getUserById } from '../../../lib/db';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: true, authenticated: false });

  const user = await getUserById(getDB(), uid);
  if (!user) return Response.json({ ok: true, authenticated: false });

  return Response.json({
    ok: true,
    authenticated: true,
    user: { id: user.id, username: user.username, displayName: user.displayName },
  });
};
