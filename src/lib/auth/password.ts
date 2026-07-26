import { base64ToBytes, bytesToBase64, textEncoder, timingSafeEqual } from './_crypto';

// PBKDF2-SHA256. 저장 포맷은 자기서술형: `pbkdf2$<iterations>$<saltB64>$<hashB64>`.
// iterations 를 문자열에 담아 verify 가 파라미터를 그대로 재현하므로, 향후 값을 올려도 기존 해시 검증 가능.
const ITERATIONS = 210_000;
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

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const [scheme, iterationsRaw, saltB64, hashB64] = stored.split('$');
    if (scheme !== 'pbkdf2' || !saltB64 || !hashB64) return false;
    const iterations = Number(iterationsRaw);
    if (!Number.isInteger(iterations) || iterations < 1) return false;
    const expected = base64ToBytes(hashB64);
    const actual = await derive(plain, base64ToBytes(saltB64), iterations);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
