import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Claude Code가 .claude/worktrees/에 만드는 병렬 작업 워크트리는 저장소 사본이라
    // 기본 스캔에 걸리면 테스트가 이중 계산된다.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'verify/**', '.wrangler/**'],
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
        statements: 83,
        branches: 71,
        functions: 82,
        lines: 87,
      },
    },
  },
});
