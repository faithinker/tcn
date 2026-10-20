import type { APIRoute } from 'astro';
import { handlePublicAccount } from '../../../lib/account/public-route';
import { requestPasswordReset } from '../../../lib/account/email-flows';
import { onlyFields } from '../../../lib/account/route';
export const prerender = false;
export const POST: APIRoute = ({ request, locals }) =>
  handlePublicAccount(request, 'reset', async ({ db, body, bindings, secret }) => {
    onlyFields(body, ['email']);
    await requestPasswordReset(
      db,
      body.email,
      request,
      bindings,
      secret,
      locals?.cfContext?.waitUntil.bind(locals.cfContext),
    );
    return Response.json({ ok: true });
  });
