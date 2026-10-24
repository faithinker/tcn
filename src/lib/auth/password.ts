import { base64ToBytes, bytesToBase64, textEncoder, timingSafeEqual } from '../crypto';

// PBKDF2-SHA256. 저장 포맷은 자기서술형 `pbkdf2$<iterations>$<saltB64>$<hashB64>` 라 iterations 를 올려도 기존 해시를 검증한다.
// 반복 횟수는 Workers 요청 CPU 예산을 쓰므로 바꿀 때 password.test.ts 의 예산도 확인한다.
// 5만 회로 두는 이유: 무료 플랜은 요청당 CPU 10ms 인데 workerd 실측이 5만 회 4ms, 10만 회 8ms, OWASP 권고 60만 회 46ms 다.
// 유료 플랜(CPU 한도 30초)으로 옮기면 올린다. 그때까지는 15자 이상과 흔한 비밀번호 거부로 보완한다(password-policy.ts).
const ITERATIONS = 50_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

async function derive(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(plain),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    // TS 5.9 제네릭 타입드어레이 강화로 Uint8Array<ArrayBufferLike>가 BufferSource에
    // 바로 안 붙는다 — 런타임 무관, 명시 캐스트.
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

// 없는 아이디로 로그인할 때 대신 검증하는 해시. PBKDF2 를 건너뛰면 응답 시간으로 아이디 존재가 드러난다.
// 요청 중에 만들면 첫 요청 CPU 가 두 배가 되어 오히려 신호가 되므로 ITERATIONS 와 같은 작업량의 값을 고정해 둔다. 원문은 버렸다.
// ITERATIONS 를 바꾸면 이 값도 다시 만들어야 하며 password.test.ts 가 일치를 잠근다.
export const DUMMY_PASSWORD_HASH =
  'pbkdf2$50000$bjzxg4Gz5wa6xWhVNy48hQ==$Sn9nja1fQgD/X3lb06fdAOt2g3fXIYy8f7G8WzDzlek=';

export async function hashPassword(
  plain: string,
  options: { normalize?: boolean } = {},
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(options.normalize ? plain.normalize('NFC') : plain, salt, ITERATIONS);
  return `${options.normalize ? 'pbkdf2-nfc' : 'pbkdf2'}$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

// 손상된 저장값만 false로 처리하고 derive 실패는 런타임 오류로 전파한다.
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltB64, hashB64] = stored.split('$');
  if (!['pbkdf2', 'pbkdf2-nfc'].includes(scheme) || !saltB64 || !hashB64) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  let expected: Uint8Array;
  let salt: Uint8Array;
  try {
    expected = base64ToBytes(hashB64);
    salt = base64ToBytes(saltB64);
  } catch {
    return false; // base64 손상 = 검증 불가한 저장값
  }

  const actual = await derive(
    scheme === 'pbkdf2-nfc' ? plain.normalize('NFC') : plain,
    salt,
    iterations,
  );
  return timingSafeEqual(actual, expected);
}
