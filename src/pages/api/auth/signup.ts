import { assertPasswordNotBreached } from '../../../lib/account/password-safety';
import type { APIRoute } from 'astro';
import { buildSessionCookie, createSessionToken } from '../../../lib/auth';
import { handlePublicAccount, signupProof } from '../../../lib/account/public-route';
import { finishSignup } from '../../../lib/account/email-flows';
export const prerender = false;
export const POST: APIRoute = ({ request, url }) =>
  handlePublicAccount(request, 'signup', async ({ db, body, secret, bindings }) => {
    const id = await finishSignup(db, signupProof(request), body, (value) =>
      assertPasswordNotBreached(value, request, bindings),
    );
    const session = await createSessionToken(id, secret, { sessionVersion: 1 });
    const headers = new Headers();
    headers.append(
      'set-cookie',
      buildSessionCookie(session, { secure: url.protocol === 'https:' }),
    );
    headers.append(
      'set-cookie',
      `tcn_signup=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${url.protocol === 'https:' ? '; Secure' : ''}`,
    );
    return Response.json({ ok: true, redirectTo: '/account' }, { status: 201, headers });
  });
