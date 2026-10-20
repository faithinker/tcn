import type { APIRoute } from 'astro';
import {
  buildSessionCookie,
  createSessionToken,
  getSessionSecret,
  hashPassword,
} from '../../../lib/auth';
import { requireSameOrigin, SecurityError } from '../../../lib/auth/mutation';
import { getDB, getUserByUsername, newId } from '../../../lib/db';
import {
  memberFeaturesEnabled,
  memberFeatureUnavailable,
  signupEnabled,
} from '../../../lib/member-features';
import { validateSignup } from '../../../lib/membership/signup';

export const prerender = false;
export const POST: APIRoute = async ({ request, url }) => {
  if (!signupEnabled()) return new Response(null, { status: 404 });
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  try {
    requireSameOrigin(request);
  } catch (error) {
    if (error instanceof SecurityError)
      return Response.json({ ok: false, error: error.code }, { status: error.status });
    throw error;
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return Response.json({ ok: false, error: 'unsupported_media_type' }, { status: 415 });
  if (Number(request.headers.get('content-length')) > 8192)
    return Response.json({ ok: false, error: 'body_too_large' }, { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 8192)
    return Response.json({ ok: false, error: 'body_too_large' }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const parsed = validateSignup(input);
  if (!parsed.ok) return Response.json(parsed, { status: 400 });
  const { username, password, displayName, affiliation } = parsed.value;
  const db = getDB();
  const duplicate = () => Response.json({ ok: false, error: 'email_unavailable' }, { status: 409 });
  if (await getUserByUsername(db, username)) return duplicate();
  // Resolve configuration before creating an account, so a missing secret cannot orphan signup.
  const secret = getSessionSecret();
  const id = newId();
  const passwordHash = await hashPassword(password);
  try {
    await db
      .prepare(
        `insert into users (id, username, password_hash, display_name, affiliation, role, status, is_executive, can_access_directors_forum, session_version)
      values (?1, ?2, ?3, ?4, ?5, 'member', 'pending', 0, 0, 1)`,
      )
      .bind(id, username, passwordHash, displayName, affiliation)
      .run();
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: users.username/i.test(error.message))
      return duplicate();
    throw error;
  }
  const session = await createSessionToken(id, secret, { sessionVersion: 1 });
  return Response.json(
    { ok: true, redirectTo: '/account' },
    {
      status: 201,
      headers: { 'set-cookie': buildSessionCookie(session, { secure: url.protocol === 'https:' }) },
    },
  );
};
