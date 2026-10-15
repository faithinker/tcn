import { describe, expect, it, vi } from 'vitest';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password';

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
    expect(await verifyPassword('x', 'pbkdf2$50000$@@bad-base64@@$@@bad@@')).toBe(false);
  });

  // Workers 무료 플랜은 요청당 CPU 10ms. 로그인은 PBKDF2 외에 ~3ms 를 더 쓰므로 해시 파라미터가 예산을 넘지 않게 고정한다.
  it('keeps the work factor within the free-plan CPU budget', async () => {
    const hash = await hashPassword('budget check');
    const iterations = Number(hash.split('$')[1]);
    expect(iterations).toBeLessThanOrEqual(50_000);
    expect(iterations).toBeGreaterThanOrEqual(20_000); // 너무 낮추는 회귀도 막는다
  });

  it('verifies a hash produced with a different stored iteration count', async () => {
    // 자기서술 포맷이라 저장값의 iterations 를 그대로 재현해야 한다.
    const low = 'pbkdf2$1000$' + (await hashPassword('x')).split('$').slice(2).join('$');
    // (파라미터가 다르면 검증은 실패하되 예외 없이 false 여야 한다)
    expect(await verifyPassword('x', low)).toBe(false);
  });

  // 없는 아이디도 PBKDF2 한 번을 똑같이 돌려야 응답 시간으로 아이디 존재 여부를 알아낼 수 없다.
  describe('DUMMY_PASSWORD_HASH', () => {
    it('is a well-formed hash that makes verifyPassword do a full derivation', async () => {
      const [scheme, iterations, saltB64, hashB64] = DUMMY_PASSWORD_HASH.split('$');
      expect(scheme).toBe('pbkdf2');
      expect(Buffer.from(saltB64, 'base64')).toHaveLength(16);
      expect(Buffer.from(hashB64, 'base64')).toHaveLength(32);

      const derive = vi.spyOn(crypto.subtle, 'deriveBits');
      try {
        await expect(verifyPassword('anything', DUMMY_PASSWORD_HASH)).resolves.toBe(false);
        expect(derive).toHaveBeenCalledTimes(1);
        expect(derive.mock.calls[0][0]).toMatchObject({ iterations: Number(iterations) });
      } finally {
        derive.mockRestore();
      }
    });

    it('uses the same work factor as every real hash', async () => {
      const real = await hashPassword('work factor');
      expect(DUMMY_PASSWORD_HASH.split('$')[1]).toBe(real.split('$')[1]);
    });
  });
});
