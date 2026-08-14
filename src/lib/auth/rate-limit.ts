import { bytesToHex, sha256 } from '../crypto';

const WINDOW_SECONDS = 15 * 60;
const MAX_ATTEMPTS = 5;

export const LOGIN_RETRY_AFTER_SECONDS = WINDOW_SECONDS;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function digest(value: string): Promise<string> {
  return bytesToHex(await sha256(value));
}

export async function getLoginRateLimitKeys(
  request: Request,
  username: string,
): Promise<[string, string]> {
  const account = username.trim().toLocaleLowerCase('en-US').slice(0, 200);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const [accountHash, ipHash] = await Promise.all([
    digest(`account:${account}`),
    digest(`ip:${ip}`),
  ]);
  return [`account:${accountHash}`, `ip:${ipHash}`];
}

export async function isLoginRateLimited(
  db: D1Database,
  keys: readonly [string, string],
  at = nowSeconds(),
): Promise<boolean> {
  const row = await db
    .prepare(
      `select 1 as blocked from auth_rate_limits
       where identifier in (?1, ?2) and blocked_until > ?3
       limit 1`,
    )
    .bind(keys[0], keys[1], at)
    .first<{ blocked: number }>();
  return Boolean(row);
}

export async function recordLoginFailure(
  db: D1Database,
  keys: readonly [string, string],
  at = nowSeconds(),
): Promise<boolean> {
  const statement = db.prepare(
    `insert into auth_rate_limits
       (identifier, attempts, window_started_at, blocked_until, updated_at)
     values (?1, 1, ?2, 0, ?2)
     on conflict(identifier) do update set
       attempts = case
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then 1
         else attempts + 1
       end,
       window_started_at = case
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then ?2
         else window_started_at
       end,
       blocked_until = case
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then 0
         when attempts + 1 >= ${MAX_ATTEMPTS} then ?2 + ${WINDOW_SECONDS}
         else blocked_until
       end,
       updated_at = ?2`,
  );
  await db.batch(keys.map((key) => statement.bind(key, at)));
  return isLoginRateLimited(db, keys, at);
}

export async function clearLoginFailures(
  db: D1Database,
  keys: readonly [string, string],
): Promise<void> {
  await db
    .prepare('delete from auth_rate_limits where identifier in (?1, ?2)')
    .bind(keys[0], keys[1])
    .run();
}
