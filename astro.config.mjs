// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://thetcn.org',
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

  // platformProxy: astro dev 에서 wrangler.jsonc 의 D1/R2 바인딩을 주입한다(어댑터 v14 타입에 옵션이 없어 캐스트).
  // imageService 'compile': 어댑터 기본값(런타임 Cloudflare Images)은 이 워커에 IMAGES 바인딩이 없어
  // 프로덕션 /_image 가 깨지므로, 이미지 변형을 빌드 타임에 sharp 로 굽는다.
  adapter: cloudflare(
    /** @type {any} */ ({ platformProxy: { enabled: true }, imageService: 'compile' }),
  ),
});
