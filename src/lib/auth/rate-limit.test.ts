import { describe, expect, it, vi } from 'vitest';
import { getLoginLockSeconds, getLoginRateLimitKeys, recordLoginFailure } from './rate-limit';

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

  it('does not trust a client-provided forwarded IP fallback', async () => {
    const forged = await getLoginRateLimitKeys(
      new Request('https://tcn.example/api/auth/login', {
        headers: { 'x-forwarded-for': '203.0.113.10' },
      }),
      'Editor',
    );
    const unknown = await getLoginRateLimitKeys(
      new Request('https://tcn.example/api/auth/login'),
      'Editor',
    );

    expect(forged[1]).toBe(unknown[1]);
  });

  it('asks D1 for the longest remaining lock among every identifier', async () => {
    const first = vi.fn().mockResolvedValue({ blockedUntil: 1_900 });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;

    await expect(getLoginLockSeconds(db, ['account:key', 'ip:key'], 1_000)).resolves.toBe(900);
    expect(bind).toHaveBeenCalledWith(1_000, 'account:key', 'ip:key');
  });

  it('reports no lock when no identifier is blocked', async () => {
    const first = vi.fn().mockResolvedValue({ blockedUntil: null });
    const db = { prepare: () => ({ bind: () => ({ first }) }) } as unknown as D1Database;

    await expect(getLoginLockSeconds(db, ['account:key'], 1_000)).resolves.toBe(0);
  });

  it('updates every identifier in one D1 batch, each with its own limit, before rechecking', async () => {
    const writeBind = vi.fn((...args: unknown[]) => ({ args }));
    const first = vi.fn().mockResolvedValue({ blockedUntil: null });
    const readBind = vi.fn(() => ({ first }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: writeBind })
      .mockReturnValueOnce({ bind: readBind });
    const batch = vi.fn().mockResolvedValue([]);
    const db = { prepare, batch } as unknown as D1Database;

    await expect(
      recordLoginFailure(db, ['account:key', 'ip:key', 'device:key'], 1_000),
    ).resolves.toBe(0);
    expect(batch).toHaveBeenCalledWith([
      { args: ['account:key', 1_000, 5] },
      { args: ['ip:key', 1_000, 5] },
      { args: ['device:key', 1_000, 10] },
    ]);
    expect(readBind).toHaveBeenCalledWith(1_000, 'account:key', 'ip:key', 'device:key');
  });
});
