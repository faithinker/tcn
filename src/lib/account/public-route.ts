import { env } from 'cloudflare:workers';
import { requireSameOrigin, SecurityError } from '../auth/mutation';
import { getSessionSecret, getSessionUser } from '../auth/guard';
import { readCookie } from '../auth/cookie';
import { getDB } from '../db/client';
import { memberFeaturesEnabled, memberFeatureUnavailable, signupEnabled } from '../member-features';
import { AccountError } from './policy';
import { readAccountBody } from './route';
import type { MailBindings } from './mail';
export const mailBindings = () => env as unknown as MailBindings;
export const signupProof = (request: Request) => readCookie(request, 'tcn_signup');
export async function handlePublicAccount(
  request: Request,
  kind: 'signup' | 'reset',
  run: (args: {
    db: D1Database;
    body: Record<string, unknown>;
    secret: string;
    bindings: MailBindings;
  }) => Promise<Response>,
) {
  if (kind === 'signup' && !signupEnabled()) return new Response(null, { status: 404 });
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  try {
    requireSameOrigin(request);
    if (kind === 'signup' && (await getSessionUser(request)))
      throw new AccountError('already_signed_in', 409);
    const body = await readAccountBody(request);
    const secret = getSessionSecret();
    return await run({ db: getDB(), body, secret, bindings: mailBindings() });
  } catch (error) {
    if (error instanceof AccountError || error instanceof SecurityError)
      return Response.json(
        { ok: false, error: error.code },
        {
          status: error.status,
          headers: {
            'cache-control': 'no-store',
            ...(error.status === 429 ? { 'retry-after': '60' } : {}),
          },
        },
      );
    throw error;
  }
}
