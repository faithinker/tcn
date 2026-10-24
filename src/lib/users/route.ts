import { approvalNotice } from '../account/mail';
import { mailBindings } from '../account/public-route';
import { requireMutation } from '../auth/mutation';
import { getDB } from '../db';
import { memberFeaturesEnabled, memberFeatureUnavailable } from '../member-features';
import { readJsonWithLimit } from '../qna/payload';
import { accessLogIp } from './access-log';
import { UserChangeError } from './permissions';
import { mutateUser } from './repository';

export type Background = (task: Promise<unknown>) => Promise<void>;
type WaitUntil = (task: Promise<unknown>) => void;

function backgroundFor(waitUntil?: WaitUntil): Background {
  return async (task) => {
    const guarded = task.catch(() =>
      console.warn(JSON.stringify({ event: 'user_background_failed' })),
    );
    if (waitUntil) waitUntil(guarded);
    else await guarded;
  };
}

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
export async function handleUserMutation(
  request: Request,
  targetId: string | undefined,
  kind: 'status' | 'permissions',
  waitUntil?: WaitUntil,
): Promise<Response> {
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  const background = backgroundFor(waitUntil);
  try {
    const { user } = await requireMutation(request, { scope: 'users', require: 'executive' });
    if (!targetId) throw new UserChangeError('missing_id', 400);
    let payload: Record<string, unknown>;
    try {
      const input = await readJsonWithLimit(request, 4096);
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
      payload = input as Record<string, unknown>;
    } catch {
      throw new UserChangeError('invalid_payload', 400);
    }
    const allowed =
      kind === 'status'
        ? ['status', 'expectedRevision', 'requestId']
        : ['role', 'isExecutive', 'canAccessDirectorsForum', 'expectedRevision', 'requestId'];
    if (
      Object.keys(payload).some((key) => !allowed.includes(key)) ||
      allowed.some((key) => !(key in payload))
    )
      throw new UserChangeError('invalid_payload', 400);
    const { expectedRevision, requestId, ...value } = payload;
    // Shape validation precedes state-dependent repository validation.
    if (
      kind === 'permissions' &&
      ((value.role !== 'member' && value.role !== 'officer') ||
        typeof value.isExecutive !== 'boolean' ||
        typeof value.canAccessDirectorsForum !== 'boolean')
    )
      throw new UserChangeError('invalid_permissions', 400);
    let approvedEmail: string | undefined;
    const result = await mutateUser(getDB(), {
      actorId: user.id,
      targetId,
      kind,
      value,
      expectedRevision: expectedRevision as number,
      requestId: requestId as string,
      ip: accessLogIp(request),
      onApproved: (email) => {
        approvedEmail = email;
      },
    });
    if (approvedEmail) {
      await background(approvalNotice(getDB(), request, mailBindings(), approvedEmail));
    }
    return json({ ok: true, user: result });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && 'code' in error) {
      const known = error as { status: number; code: string };
      return json({ ok: false, error: known.code }, known.status);
    }
    return json({ ok: false, error: 'internal_error' }, 500);
  }
}
