// Cloudflare Turnstile 서버 검증. D1 에 의존하지 않는다 — 공개 Q&A 와 관리자 로그인이 함께 쓴다.
//
// 토큰은 Cloudflare 가 1회용으로 보증한다(같은 토큰을 두 번 검증하면 `timeout-or-duplicate`).
// 그래서 로그인은 이 검사만으로 충분하고, Q&A 는 그 위에 자체 재사용 방지 테이블을 한 겹 더 둔다.

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2_048;

/** Cloudflare 가 토큰을 유효하다고 보는 기간과 같다(5분). */
export const TURNSTILE_TOKEN_TTL_MS = 5 * 60 * 1_000;

export class TurnstileError extends Error {
  readonly code: 'turnstile_failed' | 'security_not_configured';
  readonly status: 403 | 503;

  constructor(code: 'turnstile_failed' | 'security_not_configured') {
    super(code);
    this.code = code;
    this.status = code === 'turnstile_failed' ? 403 : 503;
  }
}

export interface TurnstileCheckOptions {
  secret: string;
  /** 토큰이 발급된 호스트 허용 목록(정확히 일치). */
  hostnames: ReadonlySet<string>;
  /** 위젯의 `data-action`. 다른 용도의 토큰으로 이 검증을 통과하지 못하게 한다. */
  action: string;
  now?: number;
  fetch?: typeof fetch;
}

interface SiteverifyResult {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
  challenge_ts?: unknown;
}

export function parseHostnames(raw: string | null | undefined): ReadonlySet<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean),
  );
}

export async function checkTurnstile(
  token: string,
  remoteIp: string | null,
  options: TurnstileCheckOptions,
): Promise<void> {
  if (!options.secret || options.hostnames.size === 0) {
    throw new TurnstileError('security_not_configured');
  }
  if (!token || token.length > MAX_TOKEN_LENGTH) throw new TurnstileError('turnstile_failed');

  const form = new URLSearchParams({
    secret: options.secret,
    response: token,
    idempotency_key: crypto.randomUUID(),
  });
  if (remoteIp) form.set('remoteip', remoteIp);

  let result: SiteverifyResult;
  try {
    const response = await (options.fetch ?? fetch)(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`siteverify_${response.status}`);
    result = (await response.json()) as SiteverifyResult;
  } catch {
    throw new TurnstileError('turnstile_failed');
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
    age > TURNSTILE_TOKEN_TTL_MS
  ) {
    throw new TurnstileError('turnstile_failed');
  }
}
