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
      // 리팩터링 기준선 잠금(2026-07-27 실측: 84.66 / 74.06 / 85.41 / 88.73).
      // 슬라이스 정비가 커버리지를 떨어뜨리면 CI가 막는다. 올라가면 값을 올려 다시 잠근다.
      thresholds: {
        statements: 84,
        branches: 73,
        functions: 85,
        lines: 88,
      },
    },
  },
});
