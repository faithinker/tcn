import {
  base64UrlDecode,
  base64UrlEncode,
  bytesToHex,
  hmacSha256,
  sha256,
  textEncoder,
  timingSafeEqual,
} from '../crypto';
import { readCookie } from './cookie';

// 신뢰 기기: 로그인에 성공한 브라우저에 심는 서명 쿠키. 있으면 계정 잠금 대신 기기 단위 한도를 써서,
// 공격자가 계정 잠금을 일부러 걸어 실제 관리자를 쫓아내지 못하게 한다.
// 비밀번호를 대신하지 않는다. 훔쳐도 얻는 것은 잠금 우회뿐이고 기기 한도(10회)와 IP 한도는 계속 적용된다.
export const DEVICE_COOKIE = 'tcn_device';
export const DEVICE_TTL_SECONDS = 90 * 24 * 60 * 60;

// 세션 토큰과 같은 SESSION_SECRET 으로 서명하지만 서명 입력에 도메인 접두사를 붙여서, 한쪽 토큰이
// 다른 쪽으로 통하지 못한다(device.test.ts 가 서로 검증이 실패함을 잠근다).
const SIGNING_DOMAIN = 'tcn-device-v1:';

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function sign(payloadPart: string, secret: string): Promise<Uint8Array> {
  return hmacSha256(textEncoder.encode(`${SIGNING_DOMAIN}${payloadPart}`), secret);
}

export async function createDeviceToken(
  accountKey: string,
  secret: string,
  options: { issuedAt?: number; deviceId?: string } = {},
): Promise<{ token: string; deviceId: string }> {
  const deviceId = options.deviceId ?? base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const issuedAt = options.issuedAt ?? nowSeconds();
  const payload = JSON.stringify({
    a: accountKey,
    d: deviceId,
    exp: issuedAt + DEVICE_TTL_SECONDS,
  });
  const payloadPart = base64UrlEncode(textEncoder.encode(payload));
  const signature = await sign(payloadPart, secret);
  return { token: `${payloadPart}.${base64UrlEncode(signature)}`, deviceId };
}

/** 토큰이 이 계정에 대해 유효하면 기기 id 를, 아니면 null 을 돌려준다. 어떤 입력에도 던지지 않는다. */
export async function verifyDeviceToken(
  token: string | null,
  accountKey: string,
  secret: string,
  at = nowSeconds(),
): Promise<{ deviceId: string } | null> {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const [payloadPart, signaturePart] = parts;

    const expected = await sign(payloadPart, secret);
    if (!timingSafeEqual(expected, base64UrlDecode(signaturePart))) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadPart))) as {
      a?: unknown;
      d?: unknown;
      exp?: unknown;
    };
    if (
      payload.a !== accountKey ||
      typeof payload.d !== 'string' ||
      !payload.d ||
      typeof payload.exp !== 'number' ||
      at >= payload.exp
    ) {
      return null;
    }
    return { deviceId: payload.d };
  } catch {
    return null;
  }
}

/** 기기 단위 레이트리밋 식별자. 원본 기기 id 는 저장하지 않는다. */
export async function deviceRateLimitKey(deviceId: string): Promise<string> {
  return `device:${bytesToHex(await sha256(`device:${deviceId}`))}`;
}

// 로그인 엔드포인트에만 실려 가게 Path 를 좁히고, 사이트 내 이동에서만 보내도록 Strict 로 둔다.
export function buildDeviceCookie(token: string, opts: { secure: boolean }): string {
  const flags = [
    'HttpOnly',
    'SameSite=Strict',
    'Path=/api/auth/login',
    `Max-Age=${DEVICE_TTL_SECONDS}`,
  ];
  if (opts.secure) flags.push('Secure');
  return `${DEVICE_COOKIE}=${token}; ${flags.join('; ')}`;
}

export function readDeviceToken(request: Request): string | null {
  return readCookie(request, DEVICE_COOKIE);
}
