import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { LoginChallengeBindings } from '../../../lib/auth/login-challenge';
import { handlePublicAccount } from '../../../lib/account/public-route';
import { requestPasswordReset } from '../../../lib/account/email-flows';
import { requireResetChallenge } from '../../../lib/account/account-challenge';
import { onlyFields } from '../../../lib/account/route';
export const prerender = false;
export const POST: APIRoute = ({ request, url, locals }) =>
  handlePublicAccount(request, 'reset', async ({ db, body, bindings, secret }) => {
    onlyFields(body, ['email', 'turnstileToken']);
    await requireResetChallenge({
      token: typeof body.turnstileToken === 'string' ? body.turnstileToken : '',
      remoteIp: request.headers.get('cf-connecting-ip'),
      url,
      bindings: env as unknown as LoginChallengeBindings,
    });
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
