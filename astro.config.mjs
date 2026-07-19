// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// L1: 최소 스캐폴드 (Astro 5 + Tailwind 4). i18n(L3)·통합은 후속 단계에서.
export default defineConfig({
  site: 'https://tcn.pages.dev',
  vite: {
    plugins: [tailwindcss()],
  },
});
