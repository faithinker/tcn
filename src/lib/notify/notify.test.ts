import { describe, expect, it, vi } from 'vitest';

import { sendPostNotifications, type NotifyConfig, type NotifyPost } from './notify';

const post: NotifyPost = {
  id: 'p1',
  title: 'First International Seminar',
  summary: 'Experts convened.',
  eventDate: '2025-12-26',
};

const config: NotifyConfig = {
  siteUrl: 'https://tcn.example',
  discordWebhookUrl: 'https://discord.com/api/webhooks/1/secret',
  telegramToken: 'tg-token',
  telegramChatId: '-100123',
};

const ok = () => new Response(null, { status: 204 });

describe('sendPostNotifications', () => {
  it('posts to both channels with created wording and the public post URL', async () => {
    const calls: Array<{ url: string; body: string }> = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return ok();
    });

    const result = await sendPostNotifications(post, 'created', config, fetchImpl);

    expect(result).toEqual({ discord: true, telegram: true });
    const discord = calls.find((c) => c.url.includes('discord'));
    const telegram = calls.find((c) => c.url.includes('telegram'));
    expect(discord?.body).toContain('New post');
    expect(discord?.body).toContain('/seminars/2025-12-26');
    expect(telegram?.body).toContain('Updated post'.replace('Updated', 'New')); // 'New post'
    expect(telegram?.body).toContain('-100123');
  });

  it('uses updated wording for edits', async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body));
      return ok();
    });
    await sendPostNotifications(post, 'updated', config, fetchImpl);
    expect(bodies.join(' ')).toContain('Updated post');
  });

  it('skips channels whose secrets are missing without failing the other', async () => {
    const fetchImpl = vi.fn(async () => ok());
    const result = await sendPostNotifications(
      post,
      'created',
      { ...config, telegramToken: undefined },
      fetchImpl,
    );
    expect(result).toEqual({ discord: true, telegram: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures up to 2 extra attempts and isolates channel failures', async () => {
    let discordAttempts = 0;
    const fetchImpl = vi.fn(async (url: RequestInfo | URL) => {
      if (String(url).includes('discord')) {
        discordAttempts += 1;
        return new Response(null, { status: 500 });
      }
      return ok();
    });

    const result = await sendPostNotifications(post, 'created', config, fetchImpl, {
      retryDelayMs: 0,
    });

    expect(discordAttempts).toBe(3); // 1 + 2 재시도
    expect(result).toEqual({ discord: false, telegram: true });
  });

  it('escapes HTML in the Telegram message', async () => {
    const bodies: string[] = [];
    const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes('telegram')) bodies.push(String(init?.body));
      return ok();
    });
    await sendPostNotifications({ ...post, title: 'A <b>&' }, 'created', config, fetchImpl);
    expect(bodies[0]).toContain('A &lt;b&gt;&amp;');
  });

  it('times out stalled providers instead of leaving the background task hanging', async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Timed out', 'AbortError')),
          );
        }),
    );

    const result = await sendPostNotifications(
      post,
      'created',
      { ...config, telegramToken: undefined },
      fetchImpl,
      { retryDelayMs: 0, timeoutMs: 5 },
    );

    expect(result).toEqual({ discord: false, telegram: false });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
