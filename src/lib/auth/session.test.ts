import { describe, expect, it } from 'vitest';
import { SESSION_TTL_SECONDS, createSessionToken, verifySessionToken } from './session';

const SECRET = 'unit-test-secret';

describe('session token', () => {
  it('round-trips the user id', async () => {
    const now = 1_000_000;
    const token = await createSessionToken('user-1', SECRET, {
      issuedAt: now,
      sessionVersion: 3,
    });
    expect(await verifySessionToken(token, SECRET, now + 10)).toEqual({
      uid: 'user-1',
      sessionVersion: 3,
    });
  });

  it('rejects a tampered signature', async () => {
    const now = 1_000_000;
    const token = await createSessionToken('user-1', SECRET, { issuedAt: now });
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    expect(await verifySessionToken(tampered, SECRET, now)).toBeNull();
  });

  it('rejects a wrong secret', async () => {
    const token = await createSessionToken('user-1', SECRET, { issuedAt: 1000 });
    expect(await verifySessionToken(token, 'other-secret', 1000)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const now = 1_000_000;
    const token = await createSessionToken('user-1', SECRET, { issuedAt: now });
    expect(await verifySessionToken(token, SECRET, now + SESSION_TTL_SECONDS + 1)).toBeNull();
  });

  it('rejects malformed tokens', async () => {
    expect(await verifySessionToken('nonsense', SECRET, 0)).toBeNull();
    expect(await verifySessionToken('a.b.c', SECRET, 0)).toBeNull();
  });
});
