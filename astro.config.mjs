// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import { buildRedirectLines, mergeRedirectsFile } from './src/lib/content/redirects.ts';
import { loadPublicContentFromEnvironment } from './src/lib/content/adapter.ts';

import cloudflare from '@astrojs/cloudflare';

import react from '@astrojs/react';

/**
 * DB 별칭(kind/slug 변경·legacy slug)을 진짜 HTTP 301로 승격.
 * 정적 프리렌더 redirect는 meta-refresh(200)라서, 빌드 산출물의
 * _redirects에 생성 섹션을 병합한다. 로직·테스트: src/lib/content/redirects.ts
 * @returns {import('astro').AstroIntegration}
 */
function contentAliasRedirects() {
  return {
    name: 'tcn:content-alias-redirects',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const snapshot = await loadPublicContentFromEnvironment(process.env);
        const lines = buildRedirectLines(snapshot);
        const file = join(fileURLToPath(dir), '_redirects');
        const existing = await readFile(file, 'utf8').catch(() => '');
        const merged = mergeRedirectsFile(existing, lines);
        if (merged !== existing) await writeFile(file, merged, 'utf8');
        logger.info(`content aliases → _redirects: ${lines.length} candidate(s), source=${snapshot.source}`);
      },
    },
  };
}

// L3: 한국어(/ko/) + 영어(/en/). 루트('/')는 Cloudflare 국가/선호 언어 분기 전용.
export default defineConfig({
  site: 'https://tcn-ezj.pages.dev',
  integrations: [contentAliasRedirects(), react()],

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko', 'en'],
    // 공개 페이지는 /ko·/en로 직접 구성하고, 작성자용 /admin은 언어와 무관한
    // 별도 앱으로 둔다. Astro 기본 i18n 미들웨어가 /admin을 404 처리하지 않게 한다.
    routing: 'manual',
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

  // platformProxy: astro dev에서 wrangler.jsonc의 D1/R2 바인딩을 locals.runtime.env로 주입
  adapter: cloudflare({ platformProxy: { enabled: true } })
});