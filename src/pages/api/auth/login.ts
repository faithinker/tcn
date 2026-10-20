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
  buildDeviceCookie,
  createDeviceToken,
  deviceRateLimitKey,
  readDeviceToken,
  verifyDeviceToken,
} from '../../../lib/auth/device';
import {
  requireLoginChallenge,
  type LoginChallengeBindings,
} from '../../../lib/auth/login-challenge';
import {
  clearLoginFailures,
  getLoginLockSeconds,
  getLoginRateLimitKeys,
  pruneLoginRateLimits,
  recordLoginFailure,
  resetLoginAttempts,
} from '../../../lib/auth/rate-limit';
import { TurnstileError } from '../../../lib/turnstile';
import { memberDestination } from '../../../lib/membership/redirects';

export const prerender = false;

// 실패가 이어지는 동안엔 성공 경로(관리자 로그인)가 거의 안 돌아 정리가 안 된다. 50초에 한 초씩 그 초에
// 들어온 실패가 오래된 행을 치워서 공격으로 쌓이는 행이 무한히 늘지 않게 한다. 난수가 아니라 시각을
// 쓰는 건 이 판단이 보안 목적이 아니기 때문이고, 같은 시각에는 같은 답이라 테스트도 결정적이다.
const PRUNE_EVERY_SECONDS = 50;

function pruneIsDue(): boolean {
  return Math.floor(Date.now() / 1000) % PRUNE_EVERY_SECONDS === 0;
}

// 문자열이 아닌 값(객체·배열·숫자)을 String() 으로 바꾸면 "[object Object]" 같은 값이 아이디나 비밀번호로
// 쓰이므로 누락으로 취급한다.
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

interface Credentials {
  username: string;
  password: string;
  turnstileToken: string;
  returnTo: string;
}

async function readCredentials(request: Request): Promise<Credentials> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => ({}))) as {
      username?: unknown;
      password?: unknown;
      turnstileToken?: unknown;
      returnTo?: unknown;
    };
    return {
      username: text(body.username),
      password: text(body.password),
      turnstileToken: text(body.turnstileToken),
      returnTo: text(body.returnTo),
    };
  }
  const form = await request.formData().catch(() => new FormData());
  return {
    username: text(form.get('username')),
    password: text(form.get('password')),
    // 위젯이 폼에 직접 넣는 표준 필드 이름.
    turnstileToken: text(form.get('cf-turnstile-response')),
    returnTo: text(form.get('returnTo')),
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
  const credentials = await readCredentials(request);
  const { password, turnstileToken, returnTo } = credentials;
  const username = credentials.username.includes('@')
    ? credentials.username.trim().toLowerCase()
    : credentials.username;
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
  const [accountKey, ipKey] = await getLoginRateLimitKeys(request, username);
  const secret = getSessionSecret();

  // 이 계정에 로그인해 본 브라우저(서명된 신뢰 기기 쿠키)는 계정 잠금 대신 기기 단위 한도를 쓴다.
  // 계정 키는 IP 와 무관해 누구나 걸 수 있어 실제 관리자가 쫓겨나면 안 된다. 비밀번호·챌린지·IP 한도는 그대로 적용된다.
  const trusted = await verifyDeviceToken(readDeviceToken(request), accountKey, secret);
  const deviceKey = trusted ? await deviceRateLimitKey(trusted.deviceId) : null;
  const limitKeys = deviceKey ? [deviceKey, ipKey] : [accountKey, ipKey];

  const lockedFor = await getLoginLockSeconds(db, limitKeys);
  if (lockedFor > 0) return lockedResponse(lockedFor);

  // Preserve exact legacy identifiers; only fall back to normalized new-signup email
  // when the submitted identifier has no match. Never switch accounts after a bad password.
  const exactUser = await getUserByUsername(db, credentials.username);
  const user =
    exactUser ?? (credentials.username !== username ? await getUserByUsername(db, username) : null);
  // 없는 아이디도 같은 비용의 해시 검증을 돌려, 응답 시간으로 아이디 존재 여부를 알 수 없게 한다.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    const lockedNow = await recordLoginFailure(db, limitKeys);
    if (pruneIsDue()) await pruneLoginRateLimits(db);
    if (lockedNow > 0) {
      // 새 잠금이 걸린 순간만 남긴다(Workers 관측성에서 검색 가능). 아이디와 IP 는 기록하지 않고,
      // 같은 계정을 겨냥한 시도를 묶어 볼 수 있게 계정 해시의 앞부분만 쓴다.
      console.warn(
        JSON.stringify({
          event: 'login_locked',
          retryAfter: lockedNow,
          trustedDevice: deviceKey !== null,
          account: accountKey.slice(0, 20),
        }),
      );
      return lockedResponse(lockedNow);
    }
    // 동일 응답으로 사용자 존재 여부 누설 방지.
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  // 성공 정리. IP·기기 카운터만 지우고 계정 키는 잠금 단계를 보존한다(초기화되면 단계 상승이 무의미하다).
  // 신뢰 기기로 들어왔으면 계정 행은 건드리지 않는다(잠금을 우회한 것이지 푼 것이 아니다).
  if (deviceKey) {
    await clearLoginFailures(db, [ipKey, deviceKey]);
  } else {
    await clearLoginFailures(db, [ipKey]);
    await resetLoginAttempts(db, [accountKey]);
  }
  await pruneLoginRateLimits(db);
  const secure = url.protocol === 'https:';
  const session = await createSessionToken(user.id, secret, {
    sessionVersion: user.sessionVersion,
  });
  // 로그인할 때마다 갱신해서 자주 쓰는 기기는 만료되지 않는다. 기기 id 는 유지한다.
  const device = await createDeviceToken(accountKey, secret, { deviceId: trusted?.deviceId });

  const headers = new Headers({ 'content-type': 'application/json' });
  headers.append('set-cookie', buildSessionCookie(session, { secure }));
  headers.append('set-cookie', buildDeviceCookie(device.token, { secure }));
  return new Response(
    JSON.stringify({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
      },
      redirectTo: memberDestination(user, returnTo),
    }),
    { status: 200, headers },
  );
};
