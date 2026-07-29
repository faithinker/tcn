import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  consumeQuestionRateLimit,
  createQuestion,
  env,
  getDB,
  getQnaRateLimitKey,
  getSessionUid,
  verifyTurnstile,
} = vi.hoisted(() => ({
  consumeQuestionRateLimit: vi.fn(),
  createQuestion: vi.fn(),
  env: {
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
    QNA_TURNSTILE_HOSTNAMES: 'tcn.example',
    QNA_RATE_LIMIT_SECRET: 'rate-secret',
  },
  getDB: vi.fn(() => ({})),
  getQnaRateLimitKey: vi.fn().mockResolvedValue('qna:key'),
  getSessionUid: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock('cloudflare:workers', () => ({ env }));
vi.mock('../auth', () => ({ getSessionUid }));
vi.mock('../db', () => ({ getDB }));
vi.mock('../qna/repository', () => ({ createQuestion }));
vi.mock('../qna/security', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../qna/security')>()),
  consumeQuestionRateLimit,
  getQnaRateLimitKey,
  verifyTurnstile,
}));

import { POST } from '../../pages/api/questions/index';

function context(body: unknown, headers: Record<string, string> = {}) {
  return {
    request: new Request('https://tcn.example/api/questions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'https://tcn.example',
        'sec-fetch-site': 'same-origin',
        'cf-connecting-ip': '203.0.113.10',
        ...headers,
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    url: new URL('https://tcn.example/api/questions'),
  } as unknown as Parameters<NonNullable<typeof POST>>[0];
}

describe('POST /api/questions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue(null);
    verifyTurnstile.mockResolvedValue(undefined);
    consumeQuestionRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    createQuestion.mockResolvedValue({
      id: 'q-1',
      title: 'Title',
      body: 'Body',
      visibility: 'visible',
      revision: 1,
      answer: null,
    });
  });

  it('creates an immediately visible guest question after all security checks', async () => {
    const response = await POST!(
      context({ title: 'Title', body: 'Body', turnstileToken: 'token', website: '' }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      question: { id: 'q-1', visibility: 'visible' },
    });
    expect(verifyTurnstile).toHaveBeenCalledBefore(consumeQuestionRateLimit);
    expect(createQuestion).toHaveBeenCalledWith(expect.anything(), {
      title: 'Title',
      body: 'Body',
      askerUserId: null,
    });
  });

  it('uses the verified session user only, never a submitted author field', async () => {
    getSessionUid.mockResolvedValue('admin-1');
    const response = await POST!(
      context({
        title: 'Title',
        body: 'Body',
        turnstileToken: 'token',
        askerUserId: 'forged',
      }),
    );
    expect(response.status).toBe(400);
    expect(createQuestion).not.toHaveBeenCalled();
  });

  it('rejects cross-origin input before Turnstile or D1 work', async () => {
    const response = await POST!(
      context(
        { title: 'Title', body: 'Body', turnstileToken: 'token' },
        { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' },
      ),
    );
    expect(response.status).toBe(403);
    expect(verifyTurnstile).not.toHaveBeenCalled();
    expect(getDB).not.toHaveBeenCalled();
  });

  it('returns 413 based on actual bytes even with a forged small Content-Length', async () => {
    const response = await POST!(
      context('{"body":"' + 'x'.repeat(70_000) + '"}', { 'content-length': '1' }),
    );
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: 'payload_too_large' });
  });

  it('accepts a valid 10,000-character multibyte body within the byte ceiling', async () => {
    const body = '한'.repeat(10_000);
    const response = await POST!(
      context({ title: 'Multibyte boundary', body, turnstileToken: 'token', website: '' }),
    );

    expect(response.status).toBe(201);
    expect(createQuestion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body }),
    );
  });

  it('returns 429 and Retry-After without creating a question', async () => {
    consumeQuestionRateLimit.mockResolvedValue({ allowed: false, retryAfter: 321 });
    const response = await POST!(
      context({ title: 'Title', body: 'Body', turnstileToken: 'token' }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('321');
    expect(createQuestion).not.toHaveBeenCalled();
  });
});
