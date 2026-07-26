import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('produces a self-describing pbkdf2 string', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).toMatch(/^pbkdf2\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword('battery staple', hash)).toBe(false);
  });

  it('uses a random salt (same input → different hashes, both verify)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('returns false for a malformed stored hash', async () => {
    expect(await verifyPassword('x', 'not-a-real-hash')).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
  });
});
