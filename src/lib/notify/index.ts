// API 라우트용 알림 진입점: 시크릿을 바인딩에서 읽고 waitUntil 로 배달.
// 응답 지연 없음, 실패는 로그만 — 글 저장을 절대 막지 않는다.
import { env } from 'cloudflare:workers';

import { sendPostNotifications, type NotifyAction, type NotifyPost } from './notify';

export { sendPostNotifications } from './notify';
export type { NotifyAction, NotifyConfig, NotifyPost, NotifyResult } from './notify';

interface NotifyBindings {
  DISCORD_WEBHOOK?: string;
  TELEGRAM_TOKEN?: string;
  TELEGRAM_TO?: string;
}

function backgroundWait(promise: Promise<unknown>): void {
  // cloudflare:workers 의 waitUntil(컴팟 2025+). dev/테스트 등 미제공 환경에서는
  // fire-and-forget 으로 폴백한다.
  const maybe = (globalThis as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil;
  try {
    // 동적 접근 — 모듈이 waitUntil 을 export 하지 않는 버전에서도 빌드가 깨지지 않게.
    const wu = (env as unknown as { waitUntil?: (p: Promise<unknown>) => void }).waitUntil ?? maybe;
    if (wu) {
      wu(promise);
      return;
    }
  } catch {
    // 폴백으로 진행
  }
  void promise.catch(() => {});
}

/** 글 등록/수정 알림을 백그라운드로 발송. 시크릿 없는 채널은 건너뜀. */
export function notifyPostChange(requestUrl: string, post: NotifyPost, action: NotifyAction): void {
  const bindings = env as unknown as NotifyBindings;
  const siteUrl = new URL(requestUrl).origin;
  backgroundWait(
    sendPostNotifications(post, action, {
      siteUrl,
      discordWebhookUrl: bindings.DISCORD_WEBHOOK,
      telegramToken: bindings.TELEGRAM_TOKEN,
      telegramChatId: bindings.TELEGRAM_TO,
    }).catch(() => ({ discord: false, telegram: false })),
  );
}
