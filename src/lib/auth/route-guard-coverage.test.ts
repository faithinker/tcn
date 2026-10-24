import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// 경로 파일이 공용 가드를 부르는지 확인한다. 호출 문자열의 존재만 보므로 가드를 올바르게 썼다는
// 증명은 아니다. 올바른 사용은 가드 단위 테스트와 라우트 테스트가 맡는다.
const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));
const PAGES_DIR = join(SRC_DIR, 'pages');
const GUARDED_DIRS = ['admin', 'api', 'forum'];

// handleAdminQuestionMutation 은 requireMutation 을 대신 부르는 래퍼다(아래 마지막 테스트가 확인한다).
const GUARD_CALL =
  /\b(?:requireOfficer|requireOfficerMutation|requireOfficerPage|requireExecutive|requireExecutivePage|requireActiveAccount|requireActiveAccountPage|requireMutation|handleAdminQuestionMutation|handleUserMutation|handleAccountMutation|handlePublicAccount)\s*\(/;

// 가드가 없어도 되는 경로. 현재 존재하는 경로만 올린다(없는 항목은 테스트가 실패한다).
const PUBLIC_ROUTES: Record<string, string> = {
  'admin/login.astro': '로그인 화면은 세션 없이 열려야 한다.',
  'api/auth/login.ts': '자격 증명을 확인하는 경로이며 속도 제한이 걸려 있다.',
  'api/auth/signup/state.ts': '브라우저의 제한된 가입 쿠키에 연결된 인증 상태만 반환한다.',
  'api/auth/signup.ts': '가입 플래그와 출처·입력을 검사해 최소 권한 계정만 만든다.',
  'api/auth/logout.ts': '호출자 본인의 세션만 폐기한다.',
  'api/auth/me.ts': '호출자 본인의 상태만 알려 주고 비로그인에는 authenticated: false 를 준다.',
  'api/health.ts': '생존 확인용이고 외부 자원을 검사하지 않는다.',
  'api/ready.ts': '준비 상태 확인용이고 바인딩 유무만 알린다.',
  'api/content-fingerprint.ts':
    '정적 페이지가 오래됐는지 가리는 읽기 전용 해시만 내보내고 본문과 비공개 행은 노출하지 않는다.',
  'api/questions/index.ts': '익명 질문은 공개 기능이며 Turnstile과 속도 제한으로 보호한다.',
};

// README 규칙 3: 상태를 바꾸는 API 는 세션·동일 출처·범위별 CSRF 토큰을 함께 보는 가드를 부른다.
// handlePublicAccount 는 세션이 아직 없는 가입·재설정 요청의 동일 출처 검사와 봇 확인을 맡는다.
const MUTATION_GUARD_CALL =
  /\b(?:requireMutation|requireOfficerMutation|handleAdminQuestionMutation|handleUserMutation|handleAccountMutation|handlePublicAccount)\s*\(/;
const STATE_CHANGING_EXPORT = /export\s+const\s+(?:POST|PUT|PATCH|DELETE)\b/;

// CSRF 토큰 없이 동일 출처만 보는 상태 변경 경로. 새 항목은 이유와 함께 여기에 올린다.
const SAME_ORIGIN_ONLY: Record<string, string> = {
  'api/auth/login.ts': '세션 전 요청이라 토큰이 없다. 동일 출처, Turnstile, 잠금 단계가 보호한다.',
  'api/questions/index.ts':
    '익명 공개 질문이라 세션이 없다. 동일 출처, Turnstile, 속도 제한이 보호한다.',
  'api/maintenance/media-cleanup.ts':
    '운영자가 런북의 curl 절차(세션 쿠키 + Origin)로 부르는 멱등 정리 호출이다. 동일 출처와 officer 만 본다.',
};

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

function listRouteFiles(): string[] {
  return GUARDED_DIRS.flatMap((dir) => {
    const root = join(PAGES_DIR, dir);
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, encoding: 'utf8' })
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => /\.(?:astro|ts)$/.test(file) && !file.endsWith('.test.ts'))
      .map((file) => `${dir}/${file}`);
  });
}

describe('route guard coverage', () => {
  const files = listRouteFiles();

  it('finds the route files it is supposed to check', () => {
    expect(files).toEqual(
      expect.arrayContaining(['admin/index.astro', 'api/posts/index.ts', 'api/media/[id].ts']),
    );
  });

  it.each(files.filter((file) => !(file in PUBLIC_ROUTES)))('%s calls a shared guard', (file) => {
    const source = stripComments(readFileSync(join(PAGES_DIR, file), 'utf8'));
    expect(source, `${file} must call a guard or be listed in PUBLIC_ROUTES with a reason`).toMatch(
      GUARD_CALL,
    );
  });

  it.each(
    files.filter(
      (file) =>
        file.startsWith('api/') &&
        STATE_CHANGING_EXPORT.test(stripComments(readFileSync(join(PAGES_DIR, file), 'utf8'))),
    ),
  )('state-changing %s uses a mutation guard or is a listed same-origin-only route', (file) => {
    const source = stripComments(readFileSync(join(PAGES_DIR, file), 'utf8'));
    if (file in SAME_ORIGIN_ONLY) return;
    expect(source, `${file} changes state without a CSRF-aware guard`).toMatch(MUTATION_GUARD_CALL);
  });

  it.each(Object.keys(SAME_ORIGIN_ONLY))(
    'same-origin-only route %s still exists and still needs the exception',
    (file) => {
      expect(files, `${file} is listed but the file is gone`).toContain(file);
      expect(
        stripComments(readFileSync(join(PAGES_DIR, file), 'utf8')),
        `${file} now calls a mutation guard; remove it from SAME_ORIGIN_ONLY`,
      ).not.toMatch(MUTATION_GUARD_CALL);
    },
  );

  it.each(Object.keys(PUBLIC_ROUTES))('public route %s still exists', (file) => {
    expect(files, `${file} is listed as public but the file is gone`).toContain(file);
  });

  it('keeps the Q&A mutation wrapper behind the officer guard', () => {
    const source = stripComments(readFileSync(join(SRC_DIR, 'lib/qna/admin-route.ts'), 'utf8'));
    expect(source).toMatch(
      /requireMutation\(\s*options\.request,\s*\{\s*scope:\s*'qna',\s*require:\s*'officer'/,
    );
  });

  it('keeps the user mutation wrapper behind the executive guard and release gate', () => {
    const source = stripComments(readFileSync(join(SRC_DIR, 'lib/users/route.ts'), 'utf8'));
    expect(source).toMatch(
      /requireMutation\(\s*request,\s*\{\s*scope:\s*'users',\s*require:\s*'executive'/,
    );
    expect(source).toMatch(/memberFeaturesEnabled\s*\(/);
  });

  it('keeps posts and media mutation routes behind the CSRF-protected officer mutation guard', () => {
    for (const file of [
      'api/posts/index.ts',
      'api/posts/[id].ts',
      'api/media/index.ts',
      'api/media/[id].ts',
    ]) {
      const source = stripComments(readFileSync(join(PAGES_DIR, file), 'utf8'));
      expect(source, `${file} must call requireOfficerMutation`).toMatch(
        /\brequireOfficerMutation\s*\(/,
      );
    }
  });

  it('keeps the login route behind same-origin validation', () => {
    const source = stripComments(readFileSync(join(PAGES_DIR, 'api/auth/login.ts'), 'utf8'));
    expect(source).toMatch(/\brequireSameOrigin\s*\(/);
  });
});
