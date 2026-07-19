// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// L3: 한국어(/ko/) + 영어(/en/). 루트('/')는 Cloudflare 국가/선호 언어 분기 전용.
export default defineConfig({
  site: 'https://tcn-ezj.pages.dev',
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: false,
    },
  },
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
});
