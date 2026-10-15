// 계정을 발급할 때(scripts/create-user.mjs) 거는 비밀번호 정책. 로그인 쪽 검증이 아니다 — 이미 있는 계정을
// 막지 않고, 새로 만드는 비밀번호만 거른다.
//
// 이 파일은 의존성 없이 지워질 수 있는 문법(타입)만 쓴다. 스크립트가 빌드 없이 Node 가 `.ts` 를 직접
// 읽어 실행하기 때문이다(enum·파라미터 프로퍼티 같은 런타임 코드를 만드는 문법을 넣지 말 것).
//
// 해시는 Workers 무료 플랜의 CPU 한도 때문에 PBKDF2 50k 회에 묶여 있어(password.ts) 권고치보다 약하다.
// 그만큼 비밀번호 자체가 약하면 안 된다 — 길이와 흔한 비밀번호 거부로 그 간격을 메운다.

export const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

type PolicyResult = { ok: true } | { ok: false; reason: string };

// 사전 공격이 가장 먼저 시도하는 값과 이 사이트 이름. 소문자·영숫자만 남긴 형태로 비교한다.
const COMMON = [
  'password',
  'passw0rd',
  'qwerty',
  'qwertyuiop',
  'asdfghjkl',
  'letmein',
  'welcome',
  'admin',
  'administrator',
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'baseball',
  'sunshine',
  'princess',
  'master',
  'login',
  'secret',
  'trustno1',
  'changeme',
  'abc123',
  '1q2w3e4r',
  'zaq12wsx',
  'tcn',
  'thetcn',
  'transcultural',
  'transculturalnetwork',
  'asiacompetition',
] as const;

// 흔한 단어 뒤에 숫자만 붙인 형태(`password1234`, `letmein123456`)는 사전 공격의 첫 후보다. 뒤에 글자가
// 이어지는 긴 문장(`password-correct-horse-...`)은 허용한다.
const DECORATION = /^\d{0,8}$/;

function isRepetitive(value: string): boolean {
  for (let unit = 1; unit <= 4; unit += 1) {
    if (value.length % unit === 0 && value === value.slice(0, unit).repeat(value.length / unit)) {
      return true;
    }
  }
  return false;
}

// 123456789012 · 987654321098 · abcdefghijkl 처럼 코드값이 한 칸씩 오르거나 내리는 문자열.
function isSequential(value: string): boolean {
  if (value.length < 2) return false;
  const step = value.charCodeAt(1) - value.charCodeAt(0);
  if (Math.abs(step) !== 1) return false;
  for (let index = 2; index < value.length; index += 1) {
    if (value.charCodeAt(index) - value.charCodeAt(index - 1) !== step) return false;
  }
  return true;
}

// 숫자는 9 다음 0 으로 이어지는 것도 순서로 본다(123456789012).
function isDigitCycle(value: string): boolean {
  if (!/^\d+$/.test(value)) return false;
  const ascending = [...value].every(
    (digit, index) => index === 0 || Number(digit) === (Number(value[index - 1]) + 1) % 10,
  );
  const descending = [...value].every(
    (digit, index) => index === 0 || Number(digit) === (Number(value[index - 1]) + 9) % 10,
  );
  return ascending || descending;
}

export function checkPasswordPolicy(password: string, username: string): PolicyResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at most ${MAX_PASSWORD_LENGTH} characters.` };
  }

  const name = username.trim().toLowerCase();
  if (name.length >= 3 && password.toLowerCase().includes(name)) {
    return { ok: false, reason: 'The password must not contain the username.' };
  }

  if (isRepetitive(password) || isSequential(password) || isDigitCycle(password)) {
    return { ok: false, reason: 'The password is too repetitive or a simple sequence.' };
  }

  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isDecoratedCommon = COMMON.some(
    (word) => normalized.startsWith(word) && DECORATION.test(normalized.slice(word.length)),
  );
  if (isDecoratedCommon) {
    return {
      ok: false,
      reason: 'The password is a common word with only digits or symbols added.',
    };
  }

  return { ok: true };
}
