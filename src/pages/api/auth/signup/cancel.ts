import type { APIRoute } from 'astro';
import { handlePublicAccount, signupProof } from '../../../../lib/account/public-route';
import { abandonSignup } from '../../../../lib/account/email-flows';
import { onlyFields } from '../../../../lib/account/route';
export const prerender = false;
export const POST: APIRoute = ({ request, url }) =>
  handlePublicAccount(request, 'signup', async ({ db, body }) => {
    onlyFields(body, []);
    await abandonSignup(db, signupProof(request));
    return Response.json(
      { ok: true },
      {
        headers: {
          'set-cookie': `tcn_signup=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}`,
        },
      },
    );
  });
