import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'verify/**',
        'scripts/**',
        '**/*.test.ts',
        '**/*.config.*',
        '.astro/**',
      ]
    }
  }
});
