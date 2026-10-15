import { checkTurnstile, parseHostnames } from '../turnstile';

// 관리자 로그인에 요구하는 Turnstile. 위젯은 공개 Q&A 와 같은 키를 쓰되 `data-action` 이 달라서
// Q&A 폼에서 받은 토큰으로는 로그인 검증을 통과할 수 없다(checkTurnstile 이 action 을 비교한다).
// 검증은 D1 을 건드리기 전에 끝낸다 — IP 를 돌리며 던지는 가짜 시도가 DB 쓰기 한도를 갉아먹지 못하게.
export const LOGIN_CHALLENGE_ACTION = 'admin_login';

export interface LoginChallengeBindings {
  TURNSTILE_SECRET_KEY?: string;
  /** Q&A 와 공유하는 호스트 허용 목록(이름은 Q&A 시절 그대로). */
  QNA_TURNSTILE_HOSTNAMES?: string;
  /** 로컬·CI 전용 스위치. 아래 `isLoginChallengeBypassed` 참고. */
  LOGIN_CHALLENGE?: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// 헤드리스 브라우저 게이트(verify:admin)는 실제 Turnstile 위젯을 통과할 수 없고, 공식 dummy 키는
// 응답에 hostname 이 없어 이 검증과 맞지 않는다. 그래서 로컬 개발·CI 에 한해 끌 수 있게 한다.
//
// 두 조건이 동시에 참일 때만 우회한다: 스위치가 정확히 'off' 이고, 요청이 로컬 호스트로 들어왔다.
// 운영 Worker 에는 이 변수가 없고(.dev.vars 는 배포되지 않는다), 혹시 실수로 생겨도 호스트가
// thetcn.org 이므로 우회되지 않는다.
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
