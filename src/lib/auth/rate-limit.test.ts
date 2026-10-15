import { describe, expect, it } from 'vitest';
import { getLoginRateLimitKeys } from './rate-limit';

describe('login rate limiting', () => {
  it('hashes normalized account and IP identifiers before persistence', async () => {
    const request = new Request('https://tcn.example/api/auth/login', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    });

    const keys = await getLoginRateLimitKeys(request, ' Editor ');

    expect(keys[0]).toMatch(/^account:[a-f0-9]{64}$/);
    expect(keys[1]).toMatch(/^ip:[a-f0-9]{64}$/);
    expect(keys.join(' ')).not.toContain('editor');
    expect(keys.join(' ')).not.toContain('203.0.113.10');
  });

  // client-ip.test.ts 는 헬퍼만 본다. 로그인 키가 그 헬퍼를 실제로 쓰는지는 여기서만 잠긴다.
  it('counts every address of one IPv6 /64 as the same client', async () => {
    const keysFor = (ip: string) =>
      getLoginRateLimitKeys(
        new Request('https://tcn.example/api/auth/login', {
          headers: { 'cf-connecting-ip': ip },
        }),
        'Editor',
      );

    const [first, second, other] = await Promise.all([
      keysFor('2001:db8:1:2:aaaa:bbbb:cccc:dddd'),
      keysFor('2001:db8:1:2::1'),
      keysFor('2001:db8:1:3::1'),
    ]);

    expect(second[1]).toBe(first[1]);
    expect(other[1]).not.toBe(first[1]);
  });
});
