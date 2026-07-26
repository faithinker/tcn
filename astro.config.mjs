// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// 8단계: 영어 단일 사이트(프리픽스 없는 루트 트리). 콘텐츠는 D1 단일 원천 —
// 구 /ko·/en 경로와 legacy slug 는 public/_redirects 의 정적 301 표가 담당한다.
export default defineConfig({
  site: 'https://tcn.faithinker12.workers.dev',
  integrations: [react()],

  vite: {
    // @tailwindcss/vite와 Astro 번들 vite의 타입 버전 스큐 회피(런타임 무관, 코스메틱).
    plugins: [/** @type {any} */ (tailwindcss())],
    server: {
      allowedHosts: ['.trycloudflare.com'],
    },
    preview: {
      allowedHosts: ['.trycloudflare.com'],
    },
  },

  // platformProxy: astro dev에서 wrangler.jsonc의 D1/R2 바인딩 주입.
  // (어댑터 v14 타입 정의가 옵션을 아직 안 실어 캐스트 — 런타임 동작 확인됨)
  adapter: cloudflare(/** @type {any} */ ({ platformProxy: { enabled: true } })),
});
