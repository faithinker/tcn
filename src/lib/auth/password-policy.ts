// 계정 발급 시(scripts/create-user.mjs) 새 비밀번호만 거르는 정책이다. 기존 계정이나 로그인 검증과는 무관하다.
// 스크립트가 빌드 없이 Node 로 `.ts` 를 직접 실행하므로 타입처럼 지워지는 문법만 쓴다(enum·파라미터 프로퍼티 금지).
// 해시가 PBKDF2 50k 회로 묶여 있어(password.ts) 권고치보다 약하므로, 길이와 흔한 비밀번호 거부로 보완한다.

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
  const chars = [...value];
  for (let unit = 1; unit <= 4; unit += 1) {
    if (
      chars.length % unit === 0 &&
      value ===
        chars
          .slice(0, unit)
          .join('')
          .repeat(chars.length / unit)
    ) {
      return true;
    }
  }
  return false;
}

// 123456789012 · 987654321098 · abcdefghijkl 처럼 코드값이 한 칸씩 오르거나 내리는 문자열.
function isSequential(value: string): boolean {
  const chars = [...value];
  if (chars.length < 2) return false;
  const code = (index: number) => chars[index].codePointAt(0) ?? 0;
  const step = code(1) - code(0);
  if (Math.abs(step) !== 1) return false;
  for (let index = 2; index < chars.length; index += 1) {
    if (code(index) - code(index - 1) !== step) return false;
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

function containsUsername(password: string, username: string): boolean {
  const name = username.trim().toLowerCase();
  const lower = password.toLowerCase();
  if (name.length >= 3 && lower.includes(name)) return true;
  if (name.includes('@')) {
    const localPart = name.split('@')[0] ?? '';
    if (localPart.length >= 4 && lower.includes(localPart)) return true;
  }
  return false;
}

function isDecoratedCommon(password: string): boolean {
  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  return COMMON.some(
    (word) => normalized.startsWith(word) && DECORATION.test(normalized.slice(word.length)),
  );
}

export function isWeakPasswordShape(password: string, username = ''): boolean {
  return (
    containsUsername(password, username) ||
    isRepetitive(password) ||
    isSequential(password) ||
    isDigitCycle(password) ||
    isDecoratedCommon(password)
  );
}

export function checkPasswordPolicy(password: string, username: string): PolicyResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: `Use at most ${MAX_PASSWORD_LENGTH} characters.` };
  }

  if (containsUsername(password, username)) {
    return { ok: false, reason: 'The password must not contain the username.' };
  }

  if (isRepetitive(password) || isSequential(password) || isDigitCycle(password)) {
    return { ok: false, reason: 'The password is too repetitive or a simple sequence.' };
  }

  if (isDecoratedCommon(password)) {
    return {
      ok: false,
      reason: 'The password is a common word with only digits or symbols added.',
    };
  }

  return { ok: true };
}
