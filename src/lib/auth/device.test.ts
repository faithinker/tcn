import { describe, expect, it } from 'vitest';
import { createSessionToken } from './session';
import {
  buildDeviceCookie,
  createDeviceToken,
  DEVICE_COOKIE,
  DEVICE_TTL_SECONDS,
  deviceRateLimitKey,
  readDeviceToken,
  verifyDeviceToken,
} from './device';

const SECRET = 'unit-test-secret';
const ACCOUNT = `account:${'a'.repeat(64)}`;
const NOW = 1_700_000_000;

describe('trusted-device token', () => {
  it('round-trips the device id for the account it was issued to', async () => {
    const { token, deviceId } = await createDeviceToken(ACCOUNT, SECRET, { issuedAt: NOW });

    expect(deviceId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(await verifyDeviceToken(token, ACCOUNT, SECRET, NOW + 10)).toEqual({ deviceId });
  });

  it('keeps the same device id when it is reissued', async () => {
    const first = await createDeviceToken(ACCOUNT, SECRET, { issuedAt: NOW });
    const again = await createDeviceToken(ACCOUNT, SECRET, {
      issuedAt: NOW + 100,
      deviceId: first.deviceId,
    });

    expect(again.deviceId).toBe(first.deviceId);
    expect(again.token).not.toBe(first.token);
  });

  it('is only valid for the account it names', async () => {
    const { token } = await createDeviceToken(ACCOUNT, SECRET, { issuedAt: NOW });

    expect(await verifyDeviceToken(token, `account:${'b'.repeat(64)}`, SECRET, NOW)).toBeNull();
  });

  it('expires after 90 days', async () => {
    const { token } = await createDeviceToken(ACCOUNT, SECRET, { issuedAt: NOW });

    expect(DEVICE_TTL_SECONDS).toBe(90 * 24 * 60 * 60);
    expect(
      await verifyDeviceToken(token, ACCOUNT, SECRET, NOW + DEVICE_TTL_SECONDS - 1),
    ).not.toBeNull();
    expect(await verifyDeviceToken(token, ACCOUNT, SECRET, NOW + DEVICE_TTL_SECONDS)).toBeNull();
  });

  it('rejects a tampered payload, a tampered signature and a wrong secret', async () => {
    const { token } = await createDeviceToken(ACCOUNT, SECRET, { issuedAt: NOW });
    const [payload, signature] = token.split('.');
    // 마지막 글자는 base64url 패딩 비트라 바꿔도 같은 바이트가 될 수 있다 — 데이터 비트가 있는 중간 글자를 바꾼다.
    const flip = (part: string) =>
      `${part.slice(0, 4)}${part[4] === 'A' ? 'B' : 'A'}${part.slice(5)}`;

    expect(
      await verifyDeviceToken(`${flip(payload)}.${signature}`, ACCOUNT, SECRET, NOW),
    ).toBeNull();
    expect(
      await verifyDeviceToken(`${payload}.${flip(signature)}`, ACCOUNT, SECRET, NOW),
    ).toBeNull();
    expect(await verifyDeviceToken(token, ACCOUNT, 'other-secret', NOW)).toBeNull();
  });

  it('rejects missing, empty and malformed input without throwing', async () => {
    for (const token of [null, '', 'nodot', '.', 'a.', '.b', '!!!.???', 'a.b.c']) {
      expect(await verifyDeviceToken(token, ACCOUNT, SECRET, NOW)).toBeNull();
    }
  });

  it('is not interchangeable with a session token', async () => {
    const session = await createSessionToken('user-1', SECRET, { issuedAt: NOW });
    const { token: device } = await createDeviceToken(ACCOUNT, SECRET, { issuedAt: NOW });

    expect(await verifyDeviceToken(session, ACCOUNT, SECRET, NOW)).toBeNull();
    const { verifySessionToken } = await import('./session');
    expect(await verifySessionToken(device, SECRET, NOW)).toBeNull();
  });
});

describe('deviceRateLimitKey', () => {
  it('hashes the device id under a device: prefix without leaking it', async () => {
    const key = await deviceRateLimitKey('device-id-123');

    expect(key).toMatch(/^device:[a-f0-9]{64}$/);
    expect(key).not.toContain('device-id-123');
    expect(await deviceRateLimitKey('device-id-123')).toBe(key);
    expect(await deviceRateLimitKey('another')).not.toBe(key);
  });
});

describe('device cookie', () => {
  it('is HttpOnly, Strict and limited to the sign-in endpoint', () => {
    const cookie = buildDeviceCookie('signed.token', { secure: true });

    expect(cookie).toContain(`${DEVICE_COOKIE}=signed.token`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/auth/login');
    expect(cookie).toContain(`Max-Age=${DEVICE_TTL_SECONDS}`);
    expect(cookie).toContain('Secure');
    expect(buildDeviceCookie('signed.token', { secure: false })).not.toContain('Secure');
  });

  it('is read back from the request', () => {
    const request = new Request('https://tcn.example/api/auth/login', {
      headers: { cookie: `x=1; ${DEVICE_COOKIE}=signed.token` },
    });

    expect(readDeviceToken(request)).toBe('signed.token');
    expect(readDeviceToken(new Request('https://tcn.example/api/auth/login'))).toBeNull();
  });
});
