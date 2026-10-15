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
  recordLoginFailure,
  resetLoginAttempts,
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
  const [accountKey, ipKey] = await getLoginRateLimitKeys(request, username);
  const secret = getSessionSecret();

  // 이 계정에 로그인해 본 적 있는 브라우저(서명된 신뢰 기기 쿠키)는 계정 단위 잠금 대신 기기 단위 한도를
  // 쓴다. 계정 키는 IP 와 무관해서 누구나 걸 수 있는데, 그걸로 실제 관리자까지 쫓겨나면 안 되기 때문이다.
  // 쿠키는 비밀번호를 대신하지 않는다 — 비밀번호와 챌린지는 그대로 요구하고, 기기 한도와 IP 한도도 계속 적용된다.
  const trusted = await verifyDeviceToken(readDeviceToken(request), accountKey, secret);
  const deviceKey = trusted ? await deviceRateLimitKey(trusted.deviceId) : null;
  const limitKeys = deviceKey ? [deviceKey, ipKey] : [accountKey, ipKey];

  const lockedFor = await getLoginLockSeconds(db, limitKeys);
  if (lockedFor > 0) return lockedResponse(lockedFor);

  const user = await getUserByUsername(db, username);
  // 없는 아이디도 같은 비용의 해시 검증을 돌려, 응답 시간으로 아이디 존재 여부를 알 수 없게 한다.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid) {
    const lockedNow = await recordLoginFailure(db, limitKeys);
    if (lockedNow > 0) return lockedResponse(lockedNow);
    // 동일 응답으로 사용자 존재 여부 누설 방지.
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  // 성공 정리. IP·기기 카운터는 지우지만 계정 키는 잠금 단계를 보존한다 — 관리자가 로그인할 때마다
  // 공격자가 쌓은 단계가 초기화되면 단계 상승이 의미가 없다. 신뢰 기기로 들어왔다면 계정 행은 아예
  // 건드리지 않는다(잠금을 우회한 것이지 푼 것이 아니다). 새 기기에서 성공하면 실패 횟수만 비운다.
  if (deviceKey) {
    await clearLoginFailures(db, [ipKey, deviceKey]);
  } else {
    await clearLoginFailures(db, [ipKey]);
    await resetLoginAttempts(db, [accountKey]);
  }
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
      user: { id: user.id, username: user.username, displayName: user.displayName },
    }),
    { status: 200, headers },
  );
};
