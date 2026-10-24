import { assertPasswordNotBreached } from '../../../lib/account/password-safety';
import type { APIRoute } from 'astro';
import { handlePublicAccount } from '../../../lib/account/public-route';
import { finishPasswordReset } from '../../../lib/account/email-flows';
import { onlyFields } from '../../../lib/account/route';
import { clearAccountCookies } from '../../../lib/account/cookies';
import { securityNotice } from '../../../lib/account/mail';
export const prerender = false;
export const POST: APIRoute = ({ request, url }) =>
  handlePublicAccount(request, 'reset', async ({ db, body, bindings }) => {
    onlyFields(body, ['token', 'password', 'passwordConfirmation']);
    const email = await finishPasswordReset(
      db,
      body.token,
      body.password,
      body.passwordConfirmation,
      (value) => assertPasswordNotBreached(value, request, bindings),
    );
    await securityNotice(db, request, bindings, email, 'password');
    const headers = new Headers();
    clearAccountCookies(headers, url.protocol === 'https:');
    return Response.json({ ok: true, redirectTo: '/login?notice=password-reset' }, { headers });
  });
