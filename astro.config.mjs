// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://tcn.faithinker12.workers.dev',
  integrations: [react()],
  build: {
    format: 'file',
  },

  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['.trycloudflare.com'],
    },
    preview: {
      allowedHosts: ['.trycloudflare.com'],
    },
  },

  // platformProxy: astro dev에서 wrangler.jsonc의 D1/R2 바인딩 주입.
  // (어댑터 v14 타입 정의가 옵션을 아직 안 실어 캐스트 — 런타임 동작 확인됨)
  //
  // imageService 'compile': 이미지 변형을 빌드 타임에 sharp로 생성해 정적 파일로 굽는다.
  // 어댑터 기본값은 런타임 Cloudflare Images(IMAGES 바인딩)인데 이 워커에는 그 바인딩이
  // 없어서 /_image 요청이 프로덕션에서 깨진다. 창립총회 기록은 프리렌더 정적 페이지이므로
  // 빌드 타임 생성이 맞고, 런타임 변환 비용·과금도 발생하지 않는다.
  adapter: cloudflare(
    /** @type {any} */ ({ platformProxy: { enabled: true }, imageService: 'compile' }),
  ),
});
