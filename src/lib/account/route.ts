import { getSessionAccount, getSessionUser } from '../auth/guard';
import { requireMutation, SecurityError } from '../auth/mutation';
import { getDB } from '../db/client';
import { memberFeaturesEnabled, memberFeatureUnavailable } from '../member-features';
import { AccountError, objectInput } from './policy';
import { clearAccountCookies } from './cookies';
import type { User } from '../db/types';
export async function readAccountBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new AccountError('unsupported_media_type', 415);
  if (Number(request.headers.get('content-length')) > 8192)
    throw new AccountError('body_too_large', 413);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > 8192) throw new AccountError('body_too_large', 413);
  try {
    return objectInput(JSON.parse(raw));
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError('invalid_json');
  }
}
export async function handleAccountMutation(
  request: Request,
  run: (
    db: D1Database,
    user: User,
    body: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
  endSession = false,
) {
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  try {
    await requireMutation(
      request,
      { scope: 'account', require: 'signedIn' },
      { getUser: getSessionUser },
    );
    const user = await getSessionAccount(request);
    if (!user) throw new AccountError('unauthorized', 401);
    const body = await readAccountBody(request);
    const data = await run(getDB(), user, body);
    const headers = new Headers({ 'cache-control': 'no-store' });
    if (endSession) clearAccountCookies(headers, new URL(request.url).protocol === 'https:');
    return Response.json({ ok: true, ...data }, { headers });
  } catch (error) {
    if (error instanceof AccountError || error instanceof SecurityError) {
      const headers = new Headers({ 'cache-control': 'no-store' });
      if (error.code === 'session_ended' || error.code === 'unauthorized')
        clearAccountCookies(headers, new URL(request.url).protocol === 'https:');
      return Response.json({ ok: false, error: error.code }, { status: error.status, headers });
    }
    throw error;
  }
}
export function onlyFields(body: Record<string, unknown>, fields: string[]) {
  if (Object.keys(body).some((k) => !fields.includes(k))) throw new AccountError('invalid_fields');
}
