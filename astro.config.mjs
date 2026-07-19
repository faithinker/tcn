// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// L3: 한국어 기본(prefix 없음) + 영어 옵션(/en/). ko='/', en='/en/'.
export default defineConfig({
  site: 'https://tcn.pages.dev',
  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  vite: {
    // @tailwindcss/vite와 Astro 번들 vite의 타입 버전 스큐 회피(런타임 무관, 코스메틱).
    plugins: [/** @type {any} */ (tailwindcss())],
  },
});
