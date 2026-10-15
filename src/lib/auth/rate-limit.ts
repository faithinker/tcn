import { clientIpKey } from '../client-ip';
import { bytesToHex, sha256 } from '../crypto';

// 실패를 세는 윈도. 이 안에 MAX 번 틀리면 잠긴다.
const WINDOW_SECONDS = 15 * 60;

// 잠금은 다시 얻을 때마다 길어진다. IP 를 바꿔 가며 한 계정을 찍는 추측을 하루 몇 번으로 줄인다.
// 마지막 값이 상한이다.
const LOCK_SECONDS = [15 * 60, 60 * 60, 4 * 60 * 60, 24 * 60 * 60] as const;

const MAX_ATTEMPTS = 5;
// 신뢰 기기(`device:` 식별자)는 오타가 잦은 실제 사용자라 한도를 넉넉히 준다.
const DEVICE_MAX_ATTEMPTS = 10;

const LOCK_DURATION_SQL = `case lock_count + 1 ${LOCK_SECONDS.map(
  (seconds, index) => `when ${index + 1} then ${seconds}`,
).join(' ')} else ${LOCK_SECONDS[LOCK_SECONDS.length - 1]} end`;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function maxAttemptsFor(identifier: string): number {
  return identifier.startsWith('device:') ? DEVICE_MAX_ATTEMPTS : MAX_ATTEMPTS;
}

function placeholders(count: number, first: number): string {
  return Array.from({ length: count }, (_, index) => `?${first + index}`).join(', ');
}

async function digest(value: string): Promise<string> {
  return bytesToHex(await sha256(value));
}

export async function getLoginRateLimitKeys(
  request: Request,
  username: string,
): Promise<[string, string]> {
  const account = username.trim().toLocaleLowerCase('en-US').slice(0, 200);
  const ip = clientIpKey(request);
  const [accountHash, ipHash] = await Promise.all([
    digest(`account:${account}`),
    digest(`ip:${ip}`),
  ]);
  return [`account:${accountHash}`, `ip:${ipHash}`];
}

/** 식별자 중 하나라도 잠겨 있으면 가장 많이 남은 잠금 시간(초)을, 아니면 0 을 돌려준다. */
export async function getLoginLockSeconds(
  db: D1Database,
  keys: readonly string[],
  at = nowSeconds(),
): Promise<number> {
  if (keys.length === 0) return 0;
  const row = await db
    .prepare(
      `select max(blocked_until) as blockedUntil from auth_rate_limits
       where blocked_until > ?1 and identifier in (${placeholders(keys.length, 2)})`,
    )
    .bind(at, ...keys)
    .first<{ blockedUntil: number | null }>();
  return row?.blockedUntil ? row.blockedUntil - at : 0;
}

/**
 * 실패 한 번을 모든 식별자에 센다. 한 번 호출 뒤 남은 잠금 시간(초)을 돌려준다(잠기지 않았으면 0).
 *
 * - 이미 잠긴 식별자는 세지도, 잠금을 늘리지도 않는다. 요청이 겹쳐 들어와도 잠금이 풀리거나
 *   무한히 길어지지 않는다.
 * - 윈도가 지나도 잠금이 유효한 동안엔 윈도를 되돌리지 않는다(15분 윈도가 1시간 잠금을 풀면 안 된다).
 * - 잠금이 끝나면 새 윈도에서 다시 센다. `lock_count` 는 줄이지 않아서 다음 잠금이 더 길어진다.
 */
export async function recordLoginFailure(
  db: D1Database,
  keys: readonly string[],
  at = nowSeconds(),
): Promise<number> {
  if (keys.length === 0) return 0;

  const statement = db.prepare(
    `insert into auth_rate_limits
       (identifier, attempts, window_started_at, blocked_until, lock_count, updated_at)
     values (?1, 1, ?2, 0, 0, ?2)
     on conflict(identifier) do update set
       attempts = case
         when blocked_until > ?2 then attempts
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then 1
         else attempts + 1
       end,
       window_started_at = case
         when blocked_until > ?2 then window_started_at
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then ?2
         else window_started_at
       end,
       lock_count = case
         when blocked_until > ?2 then lock_count
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then lock_count
         when attempts + 1 >= ?3 then lock_count + 1
         else lock_count
       end,
       blocked_until = case
         when blocked_until > ?2 then blocked_until
         when window_started_at <= ?2 - ${WINDOW_SECONDS} then 0
         when attempts + 1 >= ?3 then ?2 + (${LOCK_DURATION_SQL})
         else blocked_until
       end,
       updated_at = ?2`,
  );
  await db.batch(keys.map((key) => statement.bind(key, at, maxAttemptsFor(key))));
  return getLoginLockSeconds(db, keys, at);
}

export async function clearLoginFailures(db: D1Database, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  await db
    .prepare(`delete from auth_rate_limits where identifier in (${placeholders(keys.length, 1)})`)
    .bind(...keys)
    .run();
}

/**
 * 로그인에 성공한 뒤 계정 키를 정리한다: 실패 횟수만 0 으로 되돌리고 잠금 단계(`lock_count`)와
 * 이미 걸린 잠금은 그대로 둔다. 행을 지워 버리면 관리자가 로그인할 때마다 공격자가 쌓아 둔
 * 잠금 단계(15분 → 1시간 → …)가 처음으로 돌아가서, 단계 상승이 IP 를 돌리는 추측을 늦추지 못한다.
 */
export async function resetLoginAttempts(db: D1Database, keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  await db
    .prepare(
      `update auth_rate_limits set attempts = 0 where identifier in (${placeholders(keys.length, 1)})`,
    )
    .bind(...keys)
    .run();
}
