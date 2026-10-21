import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import type { LoginChallengeBindings } from '../../../../lib/auth/login-challenge';
import { handlePublicAccount } from '../../../../lib/account/public-route';
import { beginSignup } from '../../../../lib/account/email-flows';
import { onlyFields } from '../../../../lib/account/route';
import { requireSignupChallenge } from '../../../../lib/account/account-challenge';
export const prerender = false;
export const POST: APIRoute = ({ request, url }) =>
  handlePublicAccount(request, 'signup', async ({ db, body, bindings, secret }) => {
    onlyFields(body, ['email', 'turnstileToken']);
    await requireSignupChallenge({
      token: typeof body.turnstileToken === 'string' ? body.turnstileToken : '',
      remoteIp: request.headers.get('cf-connecting-ip'),
      url,
      bindings: env as unknown as LoginChallengeBindings,
    });
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
