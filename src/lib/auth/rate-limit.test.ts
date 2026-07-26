import { describe, expect, it, vi } from 'vitest';
import {
  getLoginRateLimitKeys,
  isLoginRateLimited,
  recordLoginFailure,
} from './rate-limit';

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

  it('checks either identifier for an active block', async () => {
    const first = vi.fn().mockResolvedValue({ blocked: 1 });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;

    await expect(
      isLoginRateLimited(db, ['account:key', 'ip:key'], 1_000),
    ).resolves.toBe(true);
    expect(bind).toHaveBeenCalledWith('account:key', 'ip:key', 1_000);
  });

  it('updates account and IP counters in one D1 batch before rechecking', async () => {
    const writeBind = vi.fn((...args: unknown[]) => ({ args }));
    const first = vi.fn().mockResolvedValue(null);
    const readBind = vi.fn(() => ({ first }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: writeBind })
      .mockReturnValueOnce({ bind: readBind });
    const batch = vi.fn().mockResolvedValue([]);
    const db = { prepare, batch } as unknown as D1Database;

    await expect(
      recordLoginFailure(db, ['account:key', 'ip:key'], 1_000),
    ).resolves.toBe(false);
    expect(batch).toHaveBeenCalledWith([
      { args: ['account:key', 1_000] },
      { args: ['ip:key', 1_000] },
    ]);
  });
});
