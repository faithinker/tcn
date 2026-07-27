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
      ],
      // 커버리지 회귀를 막고, 실제 커버리지가 오르면 기준값도 함께 올린다.
      thresholds: {
        statements: 84,
        branches: 73,
        functions: 85,
        lines: 88,
      },
    },
  },
});
