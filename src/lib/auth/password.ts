import { base64ToBytes, bytesToBase64, textEncoder, timingSafeEqual } from '../crypto';

// PBKDF2-SHA256. 저장 포맷은 자기서술형: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
// iterations 를 문자열에 담아 verify 가 파라미터를 그대로 재현하므로, 향후 값을 올려도 기존 해시 검증 가능.
// PBKDF2는 Workers 요청 CPU 예산을 사용하므로 반복 횟수 변경 시 password.test.ts의 예산도 검증해야 한다.
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

// 존재하지 않는 아이디로 로그인할 때 대신 검증하는 해시. 저장된 계정이 없다고 PBKDF2 를 건너뛰면
// 응답이 눈에 띄게 빨라져서 어떤 아이디가 존재하는지 시간만으로 알아낼 수 있다. 같은 작업량(ITERATIONS)
// 으로 만든 값을 고정해 두는 이유는, 요청 중에 해시를 새로 만들면 그 첫 요청의 CPU 가 두 배가 되어
// (무료 플랜 10ms 예산) 오히려 구별 신호가 되기 때문이다. 원문은 만들 때 버렸다 — 누구도 모른다.
// ITERATIONS 를 바꾸면 이 값도 같은 반복 횟수로 다시 만들어야 하며 password.test.ts 가 그 일치를 잠근다.
export const DUMMY_PASSWORD_HASH =
  'pbkdf2$50000$bjzxg4Gz5wa6xWhVNy48hQ==$Sn9nja1fQgD/X3lb06fdAOt2g3fXIYy8f7G8WzDzlek=';

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

// 손상된 저장값만 false로 처리하고 derive 실패는 런타임 오류로 전파한다.
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [scheme, iterationsRaw, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'pbkdf2' || !saltB64 || !hashB64) return false;
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

  const actual = await derive(plain, salt, iterations);
  return timingSafeEqual(actual, expected);
}
