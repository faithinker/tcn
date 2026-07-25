import type { APIRoute } from 'astro';
import { clearSessionCookie } from '../../../lib/auth';

export const prerender = false;

export const POST: APIRoute = async ({ url }) => {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': clearSessionCookie({ secure: url.protocol === 'https:' }),
    },
  });
};
