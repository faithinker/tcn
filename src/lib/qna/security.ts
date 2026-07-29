import { getSessionSecret, getSessionUid } from '../auth/guard';
import { readSessionToken } from '../auth/cookie';
import { base64UrlEncode, textEncoder, timingSafeEqual } from '../auth/_crypto';

const SHORT_WINDOW_SECONDS = 10 * 60;
const DAY_WINDOW_SECONDS = 24 * 60 * 60;
const SHORT_LIMIT = 3;
const DAY_LIMIT = 20;
const TURNSTILE_TTL_MS = 5 * 60 * 1_000;

export class QnaSecurityError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function hmac(value: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(
    await crypto.subtle.sign('HMAC', key, textEncoder.encode(value) as BufferSource),
  );
}

async function digest(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', textEncoder.encode(value)));
  return base64UrlEncode(bytes);
}

export async function createCsrfToken(sessionToken: string, secret: string): Promise<string> {
  return base64UrlEncode(await hmac(`qna-csrf:${sessionToken}`, secret));
}

export async function verifyCsrfToken(
  candidate: string,
  sessionToken: string,
  secret: string,
): Promise<boolean> {
  const expected = textEncoder.encode(await createCsrfToken(sessionToken, secret));
  return timingSafeEqual(expected, textEncoder.encode(candidate));
}

export async function requireAdminMutation(
  request: Request,
  dependencies: {
    getUid?: (request: Request) => Promise<string | null>;
    sessionSecret?: string;
  } = {},
): Promise<{ uid: string }> {
  const uid = await (dependencies.getUid ?? getSessionUid)(request);
  if (!uid) throw new QnaSecurityError('unauthorized', 401);

  const expectedOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  if (!origin || origin !== expectedOrigin) throw new QnaSecurityError('invalid_origin', 403);

  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite === 'cross-site') throw new QnaSecurityError('cross_site_request', 403);

  const sessionToken = readSessionToken(request);
  if (!sessionToken) throw new QnaSecurityError('unauthorized', 401);
  const csrf = request.headers.get('x-csrf-token') ?? '';
  const secret = dependencies.sessionSecret ?? getSessionSecret();
  if (!csrf || !(await verifyCsrfToken(csrf, sessionToken, secret))) {
    throw new QnaSecurityError('invalid_csrf', 403);
  }
  return { uid };
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new QnaSecurityError('invalid_origin', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new QnaSecurityError('cross_site_request', 403);
  }
}

export async function getQnaRateLimitKey(request: Request, secret: string): Promise<string> {
  if (!secret) throw new QnaSecurityError('security_not_configured', 503);
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  return `qna:${base64UrlEncode(await hmac(`qna-ip:${ip}`, secret))}`;
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

interface SiteverifyResult {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
  challenge_ts?: unknown;
}

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
  if (!options.secret || options.hostnames.size === 0) {
    throw new QnaSecurityError('security_not_configured', 503);
  }
  if (!token || token.length > 2_048) throw new QnaSecurityError('turnstile_failed', 403);

  const form = new URLSearchParams({
    secret: options.secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (remoteIp) form.set('remoteip', remoteIp);

  let result: SiteverifyResult;
  try {
    const response = await (options.fetch ?? fetch)(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!response.ok) throw new Error(`siteverify_${response.status}`);
    result = (await response.json()) as SiteverifyResult;
  } catch {
    throw new QnaSecurityError('turnstile_failed', 403);
  }

  const now = options.now ?? Date.now();
  const challengedAt =
    typeof result.challenge_ts === 'string' ? Date.parse(result.challenge_ts) : Number.NaN;
  const age = now - challengedAt;
  if (
    result.success !== true ||
    typeof result.hostname !== 'string' ||
    !options.hostnames.has(result.hostname) ||
    result.action !== options.action ||
    !Number.isFinite(challengedAt) ||
    age < -30_000 ||
    age > TURNSTILE_TTL_MS
  ) {
    throw new QnaSecurityError('turnstile_failed', 403);
  }

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
        .bind(tokenHash, nowSeconds + TURNSTILE_TTL_MS / 1_000, nowSeconds),
    ]);
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      throw new QnaSecurityError('turnstile_replayed', 403);
    }
    throw error;
  }
}
