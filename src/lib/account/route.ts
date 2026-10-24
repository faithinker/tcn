import { getSessionAccount, getSessionUser } from '../auth/guard';
import { requireMutation, SecurityError } from '../auth/mutation';
import { getDB } from '../db/client';
import { memberFeaturesEnabled, memberFeatureUnavailable } from '../member-features';
import { QnaPayloadError, readJsonWithLimit } from '../qna/payload';
import { AccountError, objectInput } from './policy';
import { clearAccountCookies } from './cookies';
import type { User } from '../db/types';
export async function readAccountBody(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new AccountError('unsupported_media_type', 415);
  let parsed: unknown;
  try {
    parsed = await readJsonWithLimit(request, 8192);
  } catch (error) {
    if (!(error instanceof QnaPayloadError)) throw error;
    throw error.message === 'payload_too_large'
      ? new AccountError('body_too_large', 413)
      : new AccountError('invalid_json');
  }
  return objectInput(parsed);
}
// Work that must not hold up the answer, such as a notice mail. Without a runtime hook it simply runs to completion first.
export type Background = (task: Promise<unknown>) => Promise<void>;
type WaitUntil = (task: Promise<unknown>) => void;

function backgroundFor(waitUntil?: WaitUntil): Background {
  return async (task) => {
    const guarded = task.catch(() =>
      console.warn(JSON.stringify({ event: 'account_background_failed' })),
    );
    if (waitUntil) waitUntil(guarded);
    else await guarded;
  };
}

export async function handleAccountMutation(
  request: Request,
  run: (
    db: D1Database,
    user: User,
    body: Record<string, unknown>,
    background: Background,
  ) => Promise<Record<string, unknown>>,
  endSession = false,
  waitUntil?: WaitUntil,
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
    const data = await run(getDB(), user, body, backgroundFor(waitUntil));
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
