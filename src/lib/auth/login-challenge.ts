import { checkTurnstile, parseHostnames } from '../turnstile';

// 관리자 로그인에 요구하는 Turnstile. Q&A 와 같은 키지만 `data-action` 이 달라 Q&A 토큰으로는 통과할 수 없다.
// 검증은 D1 을 건드리기 전에 끝내 가짜 시도가 DB 쓰기 한도를 갉아먹지 못하게 한다.
export const LOGIN_CHALLENGE_ACTION = 'admin_login';

export interface LoginChallengeBindings {
  TURNSTILE_SECRET_KEY?: string;
  /** Q&A 와 공유하는 호스트 허용 목록(이름은 Q&A 시절 그대로). */
  QNA_TURNSTILE_HOSTNAMES?: string;
  /** 로컬·CI 전용 스위치. 아래 `isLoginChallengeBypassed` 참고. */
  LOGIN_CHALLENGE?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// verify:admin 의 헤드리스 브라우저는 Turnstile 위젯을 통과할 수 없어 로컬 개발·CI 에서만 끌 수 있게 한다.
// 스위치가 정확히 'off' 이고 요청이 로컬 호스트일 때만 우회한다. 운영에는 이 변수가 없고 호스트도 thetcn.org 다.
export function isLoginChallengeBypassed(
  bindings: Pick<LoginChallengeBindings, 'LOGIN_CHALLENGE'>,
  url: URL,
): boolean {
  return bindings.LOGIN_CHALLENGE === 'off' && LOCAL_HOSTS.has(url.hostname);
}

export async function requireLoginChallenge(input: {
  token: string;
  remoteIp: string | null;
  url: URL;
  bindings: LoginChallengeBindings;
  fetch?: typeof fetch;
  now?: number;
}): Promise<void> {
  if (isLoginChallengeBypassed(input.bindings, input.url)) return;

  await checkTurnstile(input.token, input.remoteIp, {
    secret: input.bindings.TURNSTILE_SECRET_KEY ?? '',
    hostnames: parseHostnames(input.bindings.QNA_TURNSTILE_HOSTNAMES),
    action: LOGIN_CHALLENGE_ACTION,
    fetch: input.fetch,
    now: input.now,
  });
}
