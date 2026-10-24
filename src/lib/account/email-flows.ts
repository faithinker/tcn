import { base64UrlEncode, bytesToHex, hmacSha256, sha256 } from '../crypto';
import { hashPassword } from '../auth/password';
import { getUserByUsername } from '../db/users';
import { clientIpKey } from '../client-ip';
import { validateSignup } from '../membership/signup';
import { AccountError, normalizeEmail } from './policy';
import { replacePassword } from './repository';
import {
  mailOrigin,
  requireMailReady,
  sendAccountMail,
  localMail,
  type MailBindings,
} from './mail';
const now = () => Math.floor(Date.now() / 1000);
const digest = async (value: string) => bytesToHex(await sha256(value));
const random = () => base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
interface Challenge {
  id: string;
  email: string;
  user_id: string | null;
  credential_version: number | null;
  verified_at: number | null;
  expires_at: number;
  attempts: number;
  consumed_at: number | null;
}
async function limitMail(
  db: D1Database,
  purpose: string,
  email: string,
  request: Request,
  secret: string,
) {
  const at = now();
  // Atomic conditional UPSERTs, so concurrent requests cannot pass a read-then-write check.
  // The IP is judged first, so a request its own IP limit refuses cannot burn the mailbox's slot.
  for (const [label, value, max, cooldown] of [
    ['ip', clientIpKey(request), 10, 0],
    ['email', email, 5, 60],
  ] as const) {
    const key = purpose + ':' + label + ':' + bytesToHex(await hmacSha256(value, secret));
    const result = await db
      .prepare(
        `INSERT INTO auth_mail_limits(key,attempts,started_at,last_sent_at) VALUES (?,1,?,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN started_at<=excluded.started_at-3600 THEN 1 ELSE attempts+1 END,started_at=CASE WHEN started_at<=excluded.started_at-3600 THEN excluded.started_at ELSE started_at END,last_sent_at=excluded.last_sent_at WHERE (started_at<=excluded.started_at-3600 OR attempts<?) AND last_sent_at<=excluded.last_sent_at-?`,
      )
      .bind(key, at, at, max, cooldown)
      .run();
    if (result.meta.changes !== 1) throw new AccountError('rate_limited', 429);
  }
  await db
    .prepare("DELETE FROM auth_mail_limits WHERE last_sent_at<? AND key NOT LIKE 'send-budget:%'")
    .bind(at - 86400)
    .run();
  await db.prepare('DELETE FROM auth_email_challenges WHERE expires_at<?').bind(at).run();
}
function parseProof(proof: string | null) {
  if (!proof || !/^[\w-]{8,128}\.[\w-]{40,60}$/.test(proof))
    throw new AccountError('verification_required', 400);
  const [id, token] = proof.split('.');
  return { id, token };
}
export async function signupState(
  db: D1Database,
  proof: string | null,
): Promise<{ email: string; verified: boolean; expiresAt: number } | null> {
  try {
    const { id, token } = parseProof(proof);
    const row = await db
      .prepare(
        "SELECT * FROM auth_email_challenges WHERE id=? AND proof_hash=? AND purpose='signup' AND consumed_at IS NULL AND expires_at>?",
      )
      .bind(id, await digest(token), now())
      .first<Challenge>();
    return row
      ? { email: row.email, verified: row.verified_at !== null, expiresAt: row.expires_at }
      : null;
  } catch (error) {
    if (error instanceof AccountError) return null;
    throw error;
  }
}
export async function beginSignup(
  db: D1Database,
  emailInput: unknown,
  request: Request,
  bindings: MailBindings,
  secret: string,
) {
  requireMailReady(request, bindings);
  const email = normalizeEmail(emailInput);
  await limitMail(db, 'signup', email, request, secret);
  const id = crypto.randomUUID(),
    token = random();
  let value: number;
  do {
    value = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (value >= 4294000000);
  const code = String(value % 1000000).padStart(6, '0');
  const codeHash = bytesToHex(await hmacSha256(`${id}:${code}`, secret));
  await db.batch([
    db.prepare("DELETE FROM auth_email_challenges WHERE email=? AND purpose='signup'").bind(email),
    db
      .prepare(
        "INSERT INTO auth_email_challenges(id,purpose,email,proof_hash,code_hash,expires_at,created_at) VALUES (?,'signup',?,?,?,?,?)",
      )
      .bind(id, email, await digest(token), codeHash, now() + 600, now()),
  ]);
  try {
    await sendAccountMail(
      db,
      request,
      bindings,
      email,
      'Your TCN email verification code',
      `Your TCN verification code is ${code}. It expires in 10 minutes.\n\nIf you already have an account, sign in instead. If you did not request this code, ignore this email.`,
      undefined,
      'signup',
    );
  } catch {
    await db.prepare('DELETE FROM auth_email_challenges WHERE id=?').bind(id).run();
    throw new AccountError('email_unavailable', 503);
  }
  return `${id}.${token}`;
}
export async function verifySignup(
  db: D1Database,
  proof: string | null,
  code: unknown,
  secret: string,
) {
  const { id, token } = parseProof(proof);
  const hash = await digest(token);
  const state = await signupState(db, proof);
  if (!state) throw new AccountError('verification_required');
  if (state.verified) return state;
  const codeHash = bytesToHex(
    await hmacSha256(`${id}:${typeof code === 'string' ? code : ''}`, secret),
  );
  const at = now();
  const result = await db
    .prepare(
      "UPDATE auth_email_challenges SET attempts=attempts+1,verified_at=CASE WHEN code_hash=?1 THEN ?2 ELSE NULL END,expires_at=CASE WHEN code_hash=?1 THEN ?2+1200 ELSE expires_at END WHERE id=?3 AND proof_hash=?4 AND purpose='signup' AND consumed_at IS NULL AND verified_at IS NULL AND attempts<5 AND expires_at>?2",
    )
    .bind(codeHash, at, id, hash)
    .run();
  if (result.meta.changes !== 1) throw new AccountError('verification_required');
  const updated = await signupState(db, proof);
  if (!updated?.verified) throw new AccountError('invalid_code');
  return updated;
}
export async function finishSignup(
  db: D1Database,
  proof: string | null,
  input: unknown,
  safety?: (value: string) => Promise<void>,
) {
  const parsed = validateSignup(input);
  if (!parsed.ok) throw new AccountError(parsed.error);
  const { id: challengeId, token } = parseProof(proof);
  const proofHash = await digest(token);
  const state = await signupState(db, proof);
  if (!state?.verified || state.email !== parsed.value.username)
    throw new AccountError('verification_required');
  const { username, password, displayName, affiliation } = parsed.value;
  if (safety) await safety(password);
  const id = crypto.randomUUID();
  const at = now();
  const hash = await hashPassword(password, { normalize: true });
  try {
    const result = await db.batch([
      db
        .prepare(
          "INSERT INTO users(id,username,password_hash,display_name,affiliation,role,status,is_executive,can_access_directors_forum,session_version,email_verified_at) SELECT ?,email,?,?,?,'member','pending',0,0,1,verified_at FROM auth_email_challenges WHERE id=? AND proof_hash=? AND email=? AND verified_at IS NOT NULL AND expires_at>? AND consumed_at IS NULL AND purpose='signup'",
        )
        .bind(id, hash, displayName, affiliation, challengeId, proofHash, username, at),
      db
        .prepare(
          'UPDATE auth_email_challenges SET consumed_at=? WHERE id=? AND EXISTS(SELECT 1 FROM users WHERE id=?)',
        )
        .bind(at, challengeId, id),
    ]);
    if (result[0].meta.changes !== 1) throw new AccountError('verification_required');
  } catch (error) {
    if (/UNIQUE constraint failed: users.username/.test(String(error)))
      throw new AccountError('email_taken', 409);
    throw error;
  }
  return id;
}
export async function requestPasswordReset(
  db: D1Database,
  emailInput: unknown,
  request: Request,
  bindings: MailBindings,
  secret: string,
  background?: (task: Promise<void>) => void,
) {
  requireMailReady(request, bindings);
  const email = normalizeEmail(emailInput);
  await limitMail(db, 'reset', email, request, secret);
  const task = (async () => {
    const user = await getUserByUsername(db, email);
    if (!user?.emailVerifiedAt) return;
    const token = random(),
      id = crypto.randomUUID();
    await db
      .prepare(
        "INSERT INTO auth_email_challenges(id,purpose,email,user_id,credential_version,proof_hash,expires_at,created_at) VALUES (?,'reset',?,?,?,?,?,?)",
      )
      .bind(id, email, user.id, user.sessionVersion, await digest(token), now() + 1800, now())
      .run();
    const link =
      mailOrigin(request, bindings) +
      '/reset-password?token=' +
      encodeURIComponent(`${id}.${token}`);
    try {
      await sendAccountMail(
        db,
        request,
        bindings,
        email,
        'Reset your TCN password',
        `Set a new password using this link:\n${link}\n\nThis link expires in 30 minutes and can be used once. If you did not request it, ignore this email.`,
        undefined,
        'reset',
      );
    } catch {
      await db.prepare('DELETE FROM auth_email_challenges WHERE id=?').bind(id).run();
      console.warn(JSON.stringify({ event: 'password_reset_mail_failed' }));
    }
  })().catch(() => {
    console.warn(JSON.stringify({ event: 'password_reset_dispatch_failed' }));
  });
  if (background && !localMail(request, bindings)) background(task);
  else await task;
}
export async function finishPasswordReset(
  db: D1Database,
  proof: unknown,
  password: unknown,
  confirmation: unknown,
  safety?: (value: string) => Promise<void>,
) {
  let id: string, token: string;
  try {
    ({ id, token } = parseProof(typeof proof === 'string' ? proof : null));
  } catch {
    throw new AccountError('invalid_reset_link');
  }
  const row = await db
    .prepare(
      "SELECT * FROM auth_email_challenges WHERE id=? AND proof_hash=? AND purpose='reset' AND expires_at>? AND consumed_at IS NULL",
    )
    .bind(id, await digest(token), now())
    .first<Challenge>();
  if (!row?.user_id) throw new AccountError('invalid_reset_link');
  const user = await getUserByUsername(db, row.email);
  if (!user || user.id !== row.user_id || user.sessionVersion !== row.credential_version)
    throw new AccountError('invalid_reset_link');
  // Credential update consumes every outstanding reset proof in the migration trigger.
  await replacePassword(db, user, password, confirmation, safety);
  return row.email;
}
export async function abandonSignup(db: D1Database, proof: string | null) {
  try {
    const { id, token } = parseProof(proof);
    await db
      .prepare("DELETE FROM auth_email_challenges WHERE id=? AND proof_hash=? AND purpose='signup'")
      .bind(id, await digest(token))
      .run();
  } catch (error) {
    if (!(error instanceof AccountError)) throw error;
  }
}
