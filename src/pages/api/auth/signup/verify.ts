import type { APIRoute } from 'astro';
import { handlePublicAccount, signupProof } from '../../../../lib/account/public-route';
import { verifySignup } from '../../../../lib/account/email-flows';
import { onlyFields } from '../../../../lib/account/route';
export const prerender = false;
export const POST: APIRoute = ({ request }) =>
  handlePublicAccount(request, 'signup', async ({ db, body, secret }) => {
    onlyFields(body, ['code']);
    const state = await verifySignup(db, signupProof(request), body.code, secret);
    return Response.json({ ok: true, ...state });
  });
