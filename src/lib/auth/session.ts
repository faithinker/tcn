import { base64UrlDecode, base64UrlEncode, textEncoder, timingSafeEqual } from './_crypto';

// 세션 테이블 없이 HMAC-SHA256 서명 토큰. 형식: `<payloadB64url>.<sigB64url>`.
// payload = { uid, exp(unix seconds) }. 하루 유효.
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function sign(secret: string, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data));
}

export async function createSessionToken(uid: string, secret: string, issuedAt = nowSeconds()): Promise<string> {
  const payload = JSON.stringify({ uid, exp: issuedAt + SESSION_TTL_SECONDS });
  const payloadPart = base64UrlEncode(textEncoder.encode(payload));
  const signature = await sign(secret, textEncoder.encode(payloadPart));
  return `${payloadPart}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  at = nowSeconds(),
): Promise<{ uid: string } | null> {
  try {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) return null;

    const expected = await sign(secret, textEncoder.encode(payloadPart));
    if (!timingSafeEqual(expected, base64UrlDecode(signaturePart))) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof payload.uid !== 'string' || typeof payload.exp !== 'number') return null;
    if (at >= payload.exp) return null;
    return { uid: payload.uid };
  } catch {
    return null;
  }
}
