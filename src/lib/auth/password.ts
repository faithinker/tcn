import { base64ToBytes, bytesToBase64, textEncoder, timingSafeEqual } from './_crypto';

// PBKDF2-SHA256. 저장 포맷은 자기서술형: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
// iterations 를 문자열에 담아 verify 가 파라미터를 그대로 재현하므로, 향후 값을 올려도 기존 해시 검증 가능.
//
// ⚠️ Workers 무료 플랜은 요청당 CPU 10ms. 210,000회는 약 16~25ms 라 한도를 넘어
// deriveBits 가 중단됐고, 그 결과 모든 로그인이 조용히 401 이 됐다(2026-07-27).
// D1 조회·세션 HMAC 이 ~3ms 를 더 쓰므로 PBKDF2 예산은 6ms 이하 — 50,000회로 맞춘다.
// 플랜을 Workers Paid(CPU 30초)로 올리면 이 값을 다시 높이는 것이 바람직하다.
const ITERATIONS = 50_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

async function derive(plain: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(plain), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    // TS 5.9 제네릭 타입드어레이 강화로 Uint8Array<ArrayBufferLike>가 BufferSource에
    // 바로 안 붙는다 — 런타임 무관, 명시 캐스트.
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await derive(plain, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

// 저장값이 손상된 경우만 false. derive 실패(CPU 한도 등)는 자격증명 문제가 아니므로
// 삼키지 않고 그대로 던진다 — 이전 구현은 모든 예외를 false 로 바꿔서, 런타임 장애가
// "비밀번호 틀림"으로 위장돼 원인 추적을 크게 어렵게 만들었다.
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
