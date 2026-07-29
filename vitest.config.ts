import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Claude Code가 .claude/worktrees/에 만드는 병렬 작업 워크트리는 저장소 사본이라
    // 기본 스캔에 걸리면 테스트가 이중 계산된다.
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'verify/**', '.wrangler/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      // 테스트가 한 번도 import하지 않은 런타임 모듈도 분모에 포함한다.
      // 선언형 콘텐츠와 브라우저 전용 코드는 각각 빌드·Playwright 게이트가 검증한다.
      include: [
        'src/components/admin/**/*.ts',
        'src/lib/**/*.ts',
        'src/middleware.ts',
        'src/pages/**/*.ts',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'verify/**',
        'scripts/**',
        '**/*.test.ts',
        '**/*.config.*',
        'src/components/admin/types.ts',
        'src/lib/auth/index.ts',
        'src/lib/db/index.ts',
        'src/lib/db/types.ts',
        'src/lib/media/process-image.ts',
        'src/lib/posts/index.ts',
        'src/lib/seminars/index.ts',
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
