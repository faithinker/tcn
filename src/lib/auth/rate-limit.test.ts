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
});
