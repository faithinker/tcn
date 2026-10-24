import { isLoginChallengeBypassed, type LoginChallengeBindings } from '../auth/login-challenge';
import { checkTurnstile, parseHostnames } from '../turnstile';

// 계정 메일(가입 코드·재설정 링크)을 보내기 전에 요구하는 Turnstile. 메일 발송 한도와 Resend 무료 한도를
// 봇이 소진하지 못하게 한다. 로그인·Q&A 와 같은 키지만 `data-action` 이 용도마다 달라 다른 용도의 토큰으로는 통과할 수 없다.
// 검증은 D1 을 건드리기 전에 끝내 가짜 요청이 속도 제한·발송 예산 행을 쓰지 못하게 한다.
export const SIGNUP_CHALLENGE_ACTION = 'signup_start';
export const RESET_CHALLENGE_ACTION = 'password_reset';

interface ChallengeInput {
  token: string;
  remoteIp: string | null;
  url: URL;
  bindings: LoginChallengeBindings;
  fetch?: typeof fetch;
  now?: number;
}

async function requireChallenge(action: string, input: ChallengeInput): Promise<void> {
  if (isLoginChallengeBypassed(input.bindings, input.url)) return;

  await checkTurnstile(input.token, input.remoteIp, {
    secret: input.bindings.TURNSTILE_SECRET_KEY ?? '',
    hostnames: parseHostnames(input.bindings.QNA_TURNSTILE_HOSTNAMES),
    action,
    fetch: input.fetch,
    now: input.now,
  });
}

export const requireSignupChallenge = (input: ChallengeInput) =>
  requireChallenge(SIGNUP_CHALLENGE_ACTION, input);

export const requireResetChallenge = (input: ChallengeInput) =>
  requireChallenge(RESET_CHALLENGE_ACTION, input);
