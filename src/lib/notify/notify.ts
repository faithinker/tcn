// 글 등록/수정 시 Discord·Telegram 알림. outbox 없이 waitUntil 배달 —
// 알림은 베스트에포트: 실패해도 글 저장·공개에 영향 주지 않는다.
// 시크릿이 없는 채널은 조용히 건너뛴다(로컬 dev 기본 상태).
import { seminarHref } from '../seminar-url';

export interface NotifyPost {
  id: string;
  title: string;
  summary?: string | null;
  eventDate?: string | null;
}

export type NotifyAction = 'created' | 'updated';

export interface NotifyConfig {
  siteUrl: string;
  discordWebhookUrl?: string;
  telegramToken?: string;
  telegramChatId?: string;
}

export interface NotifyResult {
  discord: boolean;
  telegram: boolean;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function deliver(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  retryDelayMs: number,
): Promise<boolean> {
  // 최초 1회 + 재시도 2회. 4xx(설정 오류)는 재시도 무의미.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, init);
      if (response.ok) return true;
      if (response.status >= 400 && response.status < 500 && response.status !== 429) return false;
    } catch {
      // 네트워크 오류 → 재시도
    }
    if (attempt < 2 && retryDelayMs > 0) await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
  }
  return false;
}

export async function sendPostNotifications(
  post: NotifyPost,
  action: NotifyAction,
  config: NotifyConfig,
  fetchImpl: typeof fetch = fetch,
  options: { retryDelayMs?: number } = {},
): Promise<NotifyResult> {
  const retryDelayMs = options.retryDelayMs ?? 2000;
  const label = action === 'created' ? 'New post' : 'Updated post';
  const path = seminarHref(post.eventDate) ?? '/seminars';
  const url = `${config.siteUrl.replace(/\/$/, '')}${path}`;

  const tasks: Array<Promise<boolean>> = [];

  if (config.discordWebhookUrl) {
    tasks.push(
      deliver(
        fetchImpl,
        config.discordWebhookUrl,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title: `${label}: ${post.title}`.slice(0, 256),
                url,
                ...(post.summary ? { description: post.summary.slice(0, 500) } : {}),
                footer: { text: 'TCN' },
              },
            ],
          }),
        },
        retryDelayMs,
      ),
    );
  } else {
    tasks.push(Promise.resolve(false));
  }

  if (config.telegramToken && config.telegramChatId) {
    tasks.push(
      deliver(
        fetchImpl,
        `https://api.telegram.org/bot${config.telegramToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text: `<b>${label}</b>\n<a href="${url}">${escapeHtml(post.title)}</a>`,
            parse_mode: 'HTML',
          }),
        },
        retryDelayMs,
      ),
    );
  } else {
    tasks.push(Promise.resolve(false));
  }

  const [discord, telegram] = await Promise.all(tasks);
  return { discord, telegram };
}
