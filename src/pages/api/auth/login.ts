import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { getDB, getUserByUsername } from '../../../lib/db';
import {
  buildSessionCookie,
  createSessionToken,
  DUMMY_PASSWORD_HASH,
  getSessionSecret,
  verifyPassword,
} from '../../../lib/auth';
import {
  requireLoginChallenge,
  type LoginChallengeBindings,
} from '../../../lib/auth/login-challenge';
import {
  clearLoginFailures,
  getLoginLockSeconds,
  getLoginRateLimitKeys,
  recordLoginFailure,
} from '../../../lib/auth/rate-limit';
import { TurnstileError } from '../../../lib/turnstile';

export const prerender = false;

interface Credentials {
  username: string;
  password: string;
  turnstileToken: string;
}

async function readCredentials(request: Request): Promise<Credentials> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      username?: unknown;
      password?: unknown;
      turnstileToken?: unknown;
    };
    return {
      username: String(body.username ?? ''),
      password: String(body.password ?? ''),
      turnstileToken: String(body.turnstileToken ?? ''),
    };
  }
  const form = await request.formData().catch(() => new FormData());
  return {
    username: String(form.get('username') ?? ''),
    password: String(form.get('password') ?? ''),
    // 위젯이 폼에 직접 넣는 표준 필드 이름.
    turnstileToken: String(form.get('cf-turnstile-response') ?? ''),
  };
}

// 잠금 시간은 단계마다 다르다 — 남은 초를 그대로 알려서 클라이언트가 정확한 안내를 보이게 한다.
function lockedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { ok: false, error: 'rate_limited' },
    { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
  );
}

export const POST: APIRoute = async ({ request, url }) => {
  const { username, password, turnstileToken } = await readCredentials(request);
  if (!username || !password) {
    return Response.json({ ok: false, error: 'missing_credentials' }, { status: 400 });
  }

  // 챌린지는 D1·락·비밀번호 작업보다 먼저 끝낸다. IP 를 돌려 가며 던지는 가짜 시도는 여기서 걸러져
  // DB 쓰기 한도를 쓰지 못하고, 챌린지 실패는 비밀번호 실패가 아니라서 실제 계정의 락을 키우지도 않는다.
  try {
    await requireLoginChallenge({
      token: turnstileToken,
      remoteIp: request.headers.get('cf-connecting-ip'),
      url,
      bindings: env as unknown as LoginChallengeBindings,
    });
  } catch (error) {
    if (error instanceof TurnstileError) {
      return Response.json({ ok: false, error: error.code }, { status: error.status });
    }
    throw error;
  }

  const db = getDB();
  const rateLimitKeys = await getLoginRateLimitKeys(request, username);
  const lockedFor = await getLoginLockSeconds(db, rateLimitKeys);
  if (lockedFor > 0) return lockedResponse(lockedFor);

  const user = await getUserByUsername(db, username);
  // 없는 아이디도 같은 비용의 해시 검증을 돌려, 응답 시간으로 아이디 존재 여부를 알 수 없게 한다.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    const lockedNow = await recordLoginFailure(db, rateLimitKeys);
    if (lockedNow > 0) return lockedResponse(lockedNow);
    // 동일 응답으로 사용자 존재 여부 누설 방지.
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  await clearLoginFailures(db, rateLimitKeys);
  const token = await createSessionToken(user.id, getSessionSecret(), {
    sessionVersion: user.sessionVersion,
  });
  return new Response(
    JSON.stringify({
      ok: true,
      user: { id: user.id, username: user.username, displayName: user.displayName },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'set-cookie': buildSessionCookie(token, { secure: url.protocol === 'https:' }),
      },
    },
  );
};
