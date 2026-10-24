import { describe, expect, it, vi } from 'vitest';

vi.mock('cloudflare:workers', () => ({ env: {} }));

import {
  consumeQuestionRateLimit,
  getQnaRateLimitKey,
  QnaSecurityError,
  requireSameOrigin,
  verifyTurnstile,
} from './security';

describe('public write origin guard', () => {
  it('requires exact same-origin metadata for public writes', () => {
    expect(() =>
      requireSameOrigin(
        new Request('https://tcn.example/api/questions', {
          method: 'POST',
          headers: { origin: 'https://tcn.example', 'sec-fetch-site': 'same-origin' },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      requireSameOrigin(
        new Request('https://tcn.example/api/questions', {
          method: 'POST',
          headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
        }),
      ),
    ).toThrow(QnaSecurityError);
  });
});

describe('Q&A HMAC rate limiting', () => {
  it('never returns or persists the original IP', async () => {
    const request = new Request('https://tcn.example/api/questions', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    });
    const key = await getQnaRateLimitKey(request, 'rate-secret');
    expect(key).toMatch(/^qna:[A-Za-z0-9_-]{43}$/);
    expect(key).not.toContain('203.0.113.10');
  });

  // client-ip.test.ts 는 헬퍼만 본다. Q&A 키가 그 헬퍼를 실제로 쓰는지는 여기서만 잠긴다.
  it('counts every address of one IPv6 /64 as the same client', async () => {
    const keyFor = (ip: string) =>
      getQnaRateLimitKey(
        new Request('https://tcn.example/api/questions', {
          headers: { 'cf-connecting-ip': ip },
        }),
        'rate-secret',
      );

    const [first, second, other] = await Promise.all([
      keyFor('2001:db8:1:2:aaaa:bbbb:cccc:dddd'),
      keyFor('2001:db8:1:2::1'),
      keyFor('2001:db8:1:3::1'),
    ]);

    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });

  it('fails closed when the rate-limit secret is missing', async () => {
    await expect(
      getQnaRateLimitKey(new Request('https://tcn.example/api/questions'), ''),
    ).rejects.toMatchObject({ code: 'security_not_configured', status: 503 });
  });

  it('fails closed with the short window when a blocked counter disappears', async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn(() => ({ first }));
    const db = { prepare: vi.fn(() => ({ bind })) } as unknown as D1Database;

    await expect(consumeQuestionRateLimit(db, 'qna:key', 1_100)).resolves.toEqual({
      allowed: false,
      retryAfter: 600,
    });
  });
});

describe('Turnstile server verification', () => {
  const validResult = {
    success: true,
    hostname: 'tcn.example',
    action: 'qna_question',
    challenge_ts: '2026-07-29T00:00:00.000Z',
  };

  function db() {
    const bind = vi.fn((...args: unknown[]) => ({ args }));
    const batch = vi.fn().mockResolvedValue([{ results: [] }, { results: [] }]);
    return {
      value: {
        prepare: vi.fn((_sql: string) => ({ bind })),
        batch,
      } as unknown as D1Database,
      bind,
      batch,
    };
  }

  function config(result: unknown = validResult) {
    return {
      secret: 'turnstile-secret',
      hostnames: new Set(['tcn.example']),
      action: 'qna_question',
      now: new Date('2026-07-29T00:04:00.000Z').getTime(),
      fetch: vi.fn().mockResolvedValue(Response.json(result)),
    };
  }

  it('checks hostname, action, age and records only a token digest', async () => {
    const database = db();
    const options = config();

    await expect(
      verifyTurnstile(database.value, 'one-time-token', '203.0.113.10', options),
    ).resolves.toBeUndefined();

    expect(options.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
    const allArgs = database.bind.mock.calls.flat().join(' ');
    expect(allArgs).not.toContain('one-time-token');
    expect(allArgs).not.toContain('203.0.113.10');
  });

  it.each([
    [{ ...validResult, success: false }, 'failed'],
    [{ ...validResult, hostname: 'evil.example' }, 'hostname'],
    [{ ...validResult, action: 'login' }, 'action'],
    [{ ...validResult, challenge_ts: '2026-07-28T23:58:00.000Z' }, 'expired'],
  ])('fails closed for invalid Siteverify result: %s', async (result) => {
    const database = db();
    await expect(
      verifyTurnstile(database.value, 'token', null, config(result)),
    ).rejects.toBeInstanceOf(QnaSecurityError);
    expect(database.batch).not.toHaveBeenCalled();
  });

  it('fails closed on Siteverify timeout or network errors', async () => {
    const database = db();
    const options = config();
    options.fetch.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    await expect(verifyTurnstile(database.value, 'token', null, options)).rejects.toMatchObject({
      code: 'turnstile_failed',
      status: 403,
    });
  });

  it('fails closed when configuration or the token is invalid', async () => {
    const database = db();
    await expect(
      verifyTurnstile(database.value, 'token', null, { ...config(), secret: '' }),
    ).rejects.toMatchObject({ code: 'security_not_configured', status: 503 });
    await expect(
      verifyTurnstile(database.value, 'x'.repeat(2_049), null, config()),
    ).rejects.toMatchObject({ code: 'turnstile_failed', status: 403 });
  });

  it('fails closed on a non-success Siteverify HTTP response', async () => {
    const database = db();
    const options = config();
    options.fetch.mockResolvedValue(new Response(null, { status: 502 }));

    await expect(verifyTurnstile(database.value, 'token', null, options)).rejects.toMatchObject({
      code: 'turnstile_failed',
      status: 403,
    });
  });

  it('rejects replay when the token digest already exists', async () => {
    const database = db();
    database.batch.mockRejectedValue(
      new Error('UNIQUE constraint failed: qna_turnstile_tokens.token_hash'),
    );
    await expect(verifyTurnstile(database.value, 'replayed', null, config())).rejects.toMatchObject(
      { code: 'turnstile_replayed', status: 403 },
    );
  });

  it('does not hide unexpected D1 replay-store failures', async () => {
    const database = db();
    database.batch.mockRejectedValue(new Error('D1 unavailable'));

    await expect(verifyTurnstile(database.value, 'token', null, config())).rejects.toThrow(
      'D1 unavailable',
    );
  });
});
