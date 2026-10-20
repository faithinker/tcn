import { localMail } from '../../../../lib/account/mail';
import type { APIRoute } from 'astro';
import { signupState } from '../../../../lib/account/email-flows';
import { signupProof, mailBindings } from '../../../../lib/account/public-route';
import {
  signupEnabled,
  memberFeaturesEnabled,
  memberFeatureUnavailable,
} from '../../../../lib/member-features';
import { getDB } from '../../../../lib/db/client';
export const prerender = false;
export const GET: APIRoute = async ({ request }) => {
  if (!signupEnabled()) return new Response(null, { status: 404 });
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  return Response.json(
    { ok: true, state: await signupState(getDB(), signupProof(request)) },
    { headers: localMail(request, mailBindings()) ? { 'x-tcn-local-mail': 'true' } : {} },
  );
};
