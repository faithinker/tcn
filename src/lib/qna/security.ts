import { requireSameOrigin, SecurityError as QnaSecurityError } from '../auth/mutation';
import { clientIpKey } from '../client-ip';
import { base64UrlEncode, hmacSha256, sha256 } from '../crypto';
import { checkTurnstile, TURNSTILE_TOKEN_TTL_MS, TurnstileError } from '../turnstile';

// 공용 보안 오류의 Q&A 이름이다. 같은 클래스라 instanceof 검사와 오류 코드·상태 코드가 그대로 유지된다.
export { QnaSecurityError, requireSameOrigin };

const SHORT_WINDOW_SECONDS = 10 * 60;
const DAY_WINDOW_SECONDS = 24 * 60 * 60;
const SHORT_LIMIT = 3;
const DAY_LIMIT = 20;

async function digest(value: string): Promise<string> {
  return base64UrlEncode(await sha256(value));
}

export async function getQnaRateLimitKey(request: Request, secret: string): Promise<string> {
  if (!secret) throw new QnaSecurityError('security_not_configured', 503);
  const ip = clientIpKey(request);
  return `qna:${base64UrlEncode(await hmacSha256(`qna-ip:${ip}`, secret))}`;
}

interface RateRow {
  short_window_started_at: number;
  short_attempts: number;
  day_window_started_at: number;
  day_attempts: number;
}

export async function consumeQuestionRateLimit(
  db: D1Database,
  identifier: string,
  at = Math.floor(Date.now() / 1_000),
): Promise<{ allowed: boolean; retryAfter: number }> {
  const statement = db
    .prepare(
      `insert into qna_rate_limits
       (identifier, short_window_started_at, short_attempts,
        day_window_started_at, day_attempts, updated_at)
       values (?1, ?2, 1, ?2, 1, ?2)
       on conflict(identifier) do update set
         short_window_started_at = case
           when short_window_started_at <= ?2 - ${SHORT_WINDOW_SECONDS} then ?2
           else short_window_started_at end,
         short_attempts = case
           when short_window_started_at <= ?2 - ${SHORT_WINDOW_SECONDS} then 1
           else short_attempts + 1 end,
         day_window_started_at = case
           when day_window_started_at <= ?2 - ${DAY_WINDOW_SECONDS} then ?2
           else day_window_started_at end,
         day_attempts = case
           when day_window_started_at <= ?2 - ${DAY_WINDOW_SECONDS} then 1
           else day_attempts + 1 end,
         updated_at = ?2
       where (
         short_window_started_at <= ?2 - ${SHORT_WINDOW_SECONDS}
         or short_attempts < ${SHORT_LIMIT}
       ) and (
         day_window_started_at <= ?2 - ${DAY_WINDOW_SECONDS}
         or day_attempts < ${DAY_LIMIT}
       )
       returning short_window_started_at, short_attempts,
                 day_window_started_at, day_attempts`,
    )
    .bind(identifier, at);
  const consumed = await statement.first<RateRow>();
  if (consumed) return { allowed: true, retryAfter: 0 };

  const current = await db
    .prepare(
      `select short_window_started_at, short_attempts,
              day_window_started_at, day_attempts
       from qna_rate_limits where identifier = ?1`,
    )
    .bind(identifier)
    .first<RateRow>();
  if (!current) return { allowed: false, retryAfter: SHORT_WINDOW_SECONDS };

  const waits = [
    current.short_attempts >= SHORT_LIMIT
      ? current.short_window_started_at + SHORT_WINDOW_SECONDS - at
      : 0,
    current.day_attempts >= DAY_LIMIT ? current.day_window_started_at + DAY_WINDOW_SECONDS - at : 0,
  ];
  return { allowed: false, retryAfter: Math.max(1, ...waits) };
}

// Siteverify 검증 자체는 공용 모듈이 맡는다(로그인도 쓴다). 여기서는 Q&A 가 얹는 한 겹 —
// 토큰 다이제스트 재사용 방지 — 만 둔다.
export async function verifyTurnstile(
  db: D1Database,
  token: string,
  remoteIp: string | null,
  options: {
    secret: string;
    hostnames: ReadonlySet<string>;
    action: string;
    now?: number;
    fetch?: typeof fetch;
  },
): Promise<void> {
  try {
    await checkTurnstile(token, remoteIp, options);
  } catch (error) {
    if (error instanceof TurnstileError) throw new QnaSecurityError(error.code, error.status);
    throw error;
  }

  const now = options.now ?? Date.now();
  const tokenHash = await digest(token);
  const nowSeconds = Math.floor(now / 1_000);
  try {
    await db.batch([
      db.prepare('delete from qna_turnstile_tokens where expires_at <= ?1').bind(nowSeconds),
      db
        .prepare(
          `insert into qna_turnstile_tokens (token_hash, expires_at, created_at)
           values (?1, ?2, ?3)`,
        )
        .bind(tokenHash, nowSeconds + TURNSTILE_TOKEN_TTL_MS / 1_000, nowSeconds),
    ]);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      throw new QnaSecurityError('turnstile_replayed', 403);
    }
    throw error;
  }
}
