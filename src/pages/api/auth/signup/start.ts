import type { APIRoute } from 'astro';
import { handlePublicAccount } from '../../../../lib/account/public-route';
import { beginSignup } from '../../../../lib/account/email-flows';
import { onlyFields } from '../../../../lib/account/route';
export const prerender = false;
export const POST: APIRoute = ({ request, url }) =>
  handlePublicAccount(request, 'signup', async ({ db, body, bindings, secret }) => {
    onlyFields(body, ['email']);
    const proof = await beginSignup(db, body.email, request, bindings, secret);
    return Response.json(
      { ok: true, expiresIn: 600, retryAfter: 60 },
      {
        headers: {
          'set-cookie': `tcn_signup=${proof}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1800${url.protocol === 'https:' ? '; Secure' : ''}`,
        },
      },
    );
  });
