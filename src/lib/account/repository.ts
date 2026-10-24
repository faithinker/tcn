import type { User } from '../db/types';
import { hashPassword, verifyPassword } from '../auth/password';
import { AccountError, normalizeNewPassword, parseProfile } from './policy';
export async function updateProfile(db: D1Database, user: User, input: Record<string, unknown>) {
  const profile = parseProfile(input);
  const result = await db
    .prepare(
      'UPDATE users SET display_name=?,affiliation=? WHERE id=? AND session_version=? AND deleted_at IS NULL',
    )
    .bind(profile.displayName, profile.affiliation, user.id, user.sessionVersion)
    .run();
  if (result.meta.changes !== 1) throw new AccountError('unauthorized', 401);
  return profile;
}
export async function reauthenticate(db: D1Database, user: User, password: unknown) {
  if (typeof password !== 'string' || password.length > 1024)
    throw new AccountError('invalid_credentials', 400);
  const current = await db
    .prepare('SELECT id FROM users WHERE id=? AND session_version=? AND deleted_at IS NULL')
    .bind(user.id, user.sessionVersion)
    .first();
  if (!current) throw new AccountError('unauthorized', 401);
  // The attempt is reserved before the password is checked, so parallel guesses cannot all pass a cap that only
  // finished failures advance. The row is cleared by a correct password, so the cap is five tries in a row.
  const reserved = await db
    .prepare(
      'INSERT INTO account_reauth_failures(user_id,session_version,attempts) VALUES (?,?,1) ON CONFLICT(user_id,session_version) DO UPDATE SET attempts=attempts+1 WHERE attempts<5 RETURNING attempts',
    )
    .bind(user.id, user.sessionVersion)
    .first<{ attempts: number }>();
  if (!reserved) return endSession(db, user);
  if (await verifyPassword(password, user.passwordHash)) {
    await db
      .prepare('DELETE FROM account_reauth_failures WHERE user_id=? AND session_version=?')
      .bind(user.id, user.sessionVersion)
      .run();
    return;
  }
  if (reserved.attempts >= 5) return endSession(db, user);
  throw new AccountError('invalid_credentials', 400);
}
async function endSession(db: D1Database, user: User): Promise<never> {
  await db
    .prepare(
      'UPDATE users SET session_version=session_version+1 WHERE id=? AND session_version=? AND deleted_at IS NULL',
    )
    .bind(user.id, user.sessionVersion)
    .run();
  throw new AccountError('session_ended', 401);
}
export async function replacePassword(
  db: D1Database,
  user: User,
  password: unknown,
  confirmation: unknown,
  safety?: (value: string) => Promise<void>,
) {
  const normalized = normalizeNewPassword(password, confirmation, user.username);
  if (await verifyPassword(normalized, user.passwordHash))
    throw new AccountError('password_unchanged');
  if (safety) await safety(normalized);
  const hash = await hashPassword(normalized, { normalize: true });
  const result = await db
    .prepare(
      'UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=? AND session_version=? AND password_hash=? AND deleted_at IS NULL RETURNING id',
    )
    .bind(hash, user.id, user.sessionVersion, user.passwordHash)
    .all<{ id: string }>();
  if (result.results.length !== 1) throw new AccountError('unauthorized', 401);
}
export async function withdrawAccount(db: D1Database, user: User, requestId: string) {
  if (!/^[\w-]{8,128}$/.test(requestId)) throw new AccountError('invalid_fields');
  const now = Math.floor(Date.now() / 1000);
  // The account_events trigger aborts the batch when the UPDATE matched nothing (stale session or an earlier withdrawal).
  const results = await db
    .batch([
      db
        .prepare(
          "UPDATE users SET username='withdrawn:'||id,password_hash='!',display_name=NULL,affiliation=NULL,email_verified_at=NULL,deleted_at=?,session_version=session_version+1 WHERE id=? AND session_version=? AND password_hash=? AND deleted_at IS NULL RETURNING id",
        )
        .bind(now, user.id, user.sessionVersion, user.passwordHash),
      db
        .prepare(
          "INSERT INTO account_events(request_id,user_id,action,created_at) VALUES (?,?,'withdrawn',?)",
        )
        .bind(requestId, user.id, now),
    ])
    .catch((error: unknown) => {
      if (error instanceof Error && error.message.includes('account_change_conflict'))
        throw new AccountError('unauthorized', 401);
      throw error;
    });
  if (results[0].results.length !== 1) throw new AccountError('unauthorized', 401);
}
