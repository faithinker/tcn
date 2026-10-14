import type { APIRoute } from 'astro';
import { getSessionUser } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const user = await getSessionUser(request);
  if (!user) return Response.json({ ok: true, authenticated: false });

  return Response.json({
    ok: true,
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
    },
  });
};
