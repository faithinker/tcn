import {
  base64UrlDecode,
  base64UrlEncode,
  hmacSha256,
  textEncoder,
  timingSafeEqual,
} from '../crypto';

// 세션 테이블 없이 HMAC-SHA256 서명 토큰. 형식: `<payloadB64url>.<sigB64url>`.
// payload = { uid, exp(unix seconds), sv(session version) }. 하루 유효.
export const SESSION_TTL_SECONDS = 60 * 60 * 24;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createSessionToken(
  uid: string,
  secret: string,
  options: { issuedAt?: number; sessionVersion?: number } = {},
): Promise<string> {
  const issuedAt = options.issuedAt ?? nowSeconds();
  const payload = JSON.stringify({
    uid,
    exp: issuedAt + SESSION_TTL_SECONDS,
    sv: options.sessionVersion ?? 1,
  });
  const payloadPart = base64UrlEncode(textEncoder.encode(payload));
  const signature = await hmacSha256(textEncoder.encode(payloadPart), secret);
  return `${payloadPart}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(
  token: string,
  secret: string,
  at = nowSeconds(),
): Promise<{ uid: string; sessionVersion: number } | null> {
  try {
    const [payloadPart, signaturePart] = token.split('.');
    if (!payloadPart || !signaturePart) return null;

    const expected = await hmacSha256(textEncoder.encode(payloadPart), secret);
    if (!timingSafeEqual(expected, base64UrlDecode(signaturePart))) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as {
      uid?: unknown;
      exp?: unknown;
      sv?: unknown;
    };
    if (
      typeof payload.uid !== 'string' ||
      typeof payload.exp !== 'number' ||
      !Number.isSafeInteger(payload.sv) ||
      Number(payload.sv) < 1
    ) {
      return null;
    }
    if (at >= payload.exp) return null;
    return { uid: payload.uid, sessionVersion: Number(payload.sv) };
  } catch {
    return null;
  }
}
