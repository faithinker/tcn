# 초문화네트워크 (Transcultural Network, TCN) - 사이트 + 콘텐츠 플랫폼

디지털·AI 시대의 **초문화(transcultural) 현상**을 연구하는 국제 학술단체 초문화네트워크(TCN)의 공식 웹사이트입니다. 영어 단일 소개 사이트에 더해, 임원이 세미나·활동 글을 직접 올리는 콘텐츠 관리 기능, 공개 Q&A, 회원 포럼과 이메일 인증 가입을 하나의 Cloudflare Worker로 제공합니다. 회원 포럼과 가입은 구현되어 있지만 기본값이 꺼짐입니다.

- **운영 주소**: [https://thetcn.org](https://thetcn.org) - 커스텀 도메인이며 canonical·sitemap의 기준 주소입니다.
- **기본 주소**: [https://tcn.faithinker12.workers.dev](https://tcn.faithinker12.workers.dev) - 같은 Worker의 `workers.dev` 주소이며 배포 후 smoke 검사의 대상입니다.
- **구버전**: [https://tcn-ezj.pages.dev](https://tcn-ezj.pages.dev) - Cloudflare Pages 정적 사이트(`/ko/`·`/en/`)입니다. 갱신되지 않으며 참고용으로만 남아 있습니다.

## 제공 기능

사용자 유형별로 할 수 있는 일입니다. 기획 의도와 대상 독자는 [`PRODUCT.md`](./PRODUCT.md), 계정과 가입의 상세 동작은 [`MEMBERSHIP_FLOW.md`](./MEMBERSHIP_FLOW.md)와 [`docs/account-lifecycle.md`](./docs/account-lifecycle.md)에 있습니다.

**공개·관리 기능 (운영 중)**

| 사용자                  | 할 수 있는 일                                              |
| ----------------------- | ---------------------------------------------------------- |
| 방문자                  | 소개·창립 선언문·정관·세미나 기록 열람, 공개 Q&A 질문 등록 |
| 임원 (회장·부회장·이사) | `/admin`에서 세미나·활동 글과 미디어 작성, Q&A 공식 답변   |

**회원 기능 (구현됨, 기본 꺼짐)**

회원 로그인·포럼·계정·사용자 관리는 `MEMBER_FEATURES_ENABLED`가, 가입은 여기에 더해 `SIGNUP_ENABLED`가 정확히 `true`일 때만 열립니다. 꺼져 있으면 회원 로그인·포럼·계정·사용자 관리는 503을, 가입 화면과 API는 404를 돌려줍니다.

| 사용자                     | 할 수 있는 일                                                                 |
| -------------------------- | ----------------------------------------------------------------------------- |
| 가입 신청자·승인 회원      | 이메일 인증 가입, 계정 관리(프로필·비밀번호 변경·탈퇴), 총회 포럼 읽기·쓰기   |
| 임원                       | 위 기능에 더해 이사회 포럼 이용                                               |
| 감사·고문                  | 승인 회원에 이사회 포럼 특별 접근만 추가. 세미나·미디어·공식 답변 권한은 없음 |
| 결정권자 (회장·수석부회장) | 가입 승인·반려·복구, 사용자 권한 관리(`/admin/users`), 타인의 포럼 글 숨김    |

반려된 계정은 로그인해서 `/account`에서 상태만 볼 수 있고 두 포럼에는 들어가지 못합니다. 자기 자신과 기존 결정권자의 상태·권한은 사이트에서 바꿀 수 없습니다.

## 구조 요약

- **런타임**: Astro 7 하이브리드 렌더와 TypeScript로 만든 하나의 Cloudflare Worker가 정적 에셋, SSR 페이지, API를 모두 처리합니다. 어드민 글쓰기 에디터만 React + Tiptap입니다. 버전은 `package.json`, Node는 `.nvmrc`(26)가 기준입니다.
- **저장소**: 콘텐츠와 계정은 D1(`DB`), 미디어 원본은 R2(`MEDIA`)에 있습니다. 스키마는 `migrations/`에 번호 순서로 쌓고, `0001_init.sql` 이후에는 추가만 합니다.
- **렌더 방식**: 홈·`/about`·`/seminars`는 빌드 직전 D1 스냅샷으로 굽는 정적 페이지라서, 세미나를 저장한 뒤 최대 약 10분과 배포 시간(약 5분)이 지나야 반영됩니다. 세미나 상세·Q&A·`/admin`·회원 영역·`/api`는 요청마다 SSR로 처리하므로 즉시 반영됩니다. 라우트별 표는 [`CONTENT_ARCHITECTURE.md` §2](./CONTENT_ARCHITECTURE.md#2-라우트)에 있습니다.
- **권한**: `src/lib/auth/permissions.ts`가 단일 원천입니다. 계정 상태(`pending`·`approved`·`rejected`)를 먼저 보고, 그다음에 역할과 결정권을 봅니다. 등급은 준회원(승인 대기) < 회원 < 이사진 < 결정권자 순서입니다.
- **용어**: 게시판은 사이트 안에서 `forum`이라고 부릅니다. `board`는 이사회(Board of Directors)와 혼동되기 때문이며, 화면 이름은 Assembly Forum(총회)과 Directors Forum(이사회)입니다.
- **디자인**: 50대 후반 이상 독자를 위한 에디토리얼 학술지 톤이며 기준은 [`DESIGN.md`](./DESIGN.md)입니다.

## 기능을 추가할 때 지킬 규칙

1. **수동 운영 배포**는 `TCN_CONTENT_SOURCE=remote npm run build && npx wrangler deploy`로만 합니다. 플래그 없이 빌드하면 로컬 D1의 테스트 세미나가 운영 홈에 나갑니다. CI 배포의 `TCN_REQUIRE_CONTENT=1`은 지우지 않습니다.
2. **새 `admin/`·`api/`·`forum/` 경로 파일**은 공용 가드(`requireOfficer*`, `requireActiveAccount*`, `requireMutation` 등)를 호출해야 합니다. 가드 없이 열어야 하는 경로는 `route-guard-coverage.test.ts`의 공개 목록에 이유와 함께 올려야 CI가 통과합니다.
3. **상태를 바꾸는 API**는 `requireMutation`으로 동일 출처와 범위별 CSRF 토큰을 검사합니다.
4. **권한 규칙을 바꿀 때**는 `permissions.ts`와 `permissions.test.ts`의 매트릭스를 함께 고칩니다.
5. **스키마 변경**은 `migrations/`에 새 번호 파일로 추가합니다. 배포 파이프라인이 Worker 배포 전에 마이그레이션을 자동으로 적용하므로, 기존 동작을 깨는 변경은 단계를 나눕니다.
6. **회원 기능 플래그**는 운영에서 임의로 켜지 않습니다. 로컬 `.dev.vars`의 `true`를 운영으로 복사하지 말고, 켜는 절차는 [`docs/deployment.md`](./docs/deployment.md#회원-기능-통합-릴리스)를 따릅니다.
7. **PR을 만들기 전에** `pr-changelog` 스킬로 `CHANGELOG.md`에 날짜별로 기록하고, PR 설명에 요약을 넣습니다.

## 빠른 시작

```bash
npm ci          # lockfile 기준 의존성 설치
npm run dev     # 개발 서버 (wrangler platformProxy로 로컬 D1/R2 바인딩)
npm run test    # Vitest 유닛 테스트 (커버리지)
npm run check   # astro check (타입·스키마)
npm run build   # dist/ 빌드
```

- Node.js는 `.nvmrc`(26)를 따릅니다(`nvm use`). 로컬 시크릿은 `.dev.vars`(커밋 제외, 키 목록은 `.env.example`)에 둡니다.
- 로컬 D1에 새 마이그레이션이 적용되지 않으면 로그인 등에서 컬럼 오류가 납니다. `npx wrangler d1 migrations apply tcn-content --local`로 적용합니다.
- 로컬에서 회원 기능을 보려면 `.dev.vars`에 `MEMBER_FEATURES_ENABLED=true`를 설정합니다. 가입 화면까지 보려면 `SIGNUP_ENABLED=true`도 설정합니다.
- 전체 명령과 브라우저·D1 검증 게이트(`verify`·`a11y`·`test:*:d1` 등)는 [`docs/development.md`](./docs/development.md#로컬-실행)에 있습니다.
- `main` 머지 시 자동 배포됩니다. 흐름과 시크릿은 [`docs/deployment.md`](./docs/deployment.md)를 보세요.
- 새 세미나·글은 개발자 없이 작성자가 `/admin`에서 등록하면 즉시 공개됩니다. [`docs/content-operations.md`](./docs/content-operations.md)를 보세요.

## 문서 안내

| 하려는 일                                        | 문서                                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 기능의 기획 의도·대상 독자 확인                  | [`PRODUCT.md`](./PRODUCT.md) · [`IDEA.md`](./IDEA.md)                                                     |
| 로컬 실행 · 검증 명령 · 기술 스택 · AI 도구 설정 | [`docs/development.md`](./docs/development.md)                                                            |
| 라우트별 렌더 방식 · 데이터 소스 · 권한          | [`CONTENT_ARCHITECTURE.md`](./CONTENT_ARCHITECTURE.md)                                                    |
| 가입·로그인·비밀번호 재설정·탈퇴 동작            | [`docs/account-lifecycle.md`](./docs/account-lifecycle.md) · [`MEMBERSHIP_FLOW.md`](./MEMBERSHIP_FLOW.md) |
| 콘텐츠 위치 · 글 등록 영향 범위 · 계정 발급      | [`docs/content-operations.md`](./docs/content-operations.md)                                              |
| 도메인 · 자동 배포 · 시크릿 · 회원 기능 릴리스   | [`docs/deployment.md`](./docs/deployment.md)                                                              |
| 복구 · 롤백 · 장애 대응 · 권한 운영              | [`docs/operations-runbook.md`](./docs/operations-runbook.md)                                              |
| 디자인 토큰 · 결정 기록                          | [`DESIGN.md`](./DESIGN.md)                                                                                |
| 변경 이력 · AI 워크플로 정책                     | [`CHANGELOG.md`](./CHANGELOG.md) · [`AGENTS.md`](./AGENTS.md)                                             |
| 과거 설계·UI 스냅샷 (날짜별 기록)                | [`docs/archive/`](./docs/archive/)                                                                        |

## 콘텐츠 원칙

- **출처 기반만 수록** - 창립 선언문·정관·확정 자료 근거만 사용.
- **추정·창작 금지** - 미확보 정보는 폴백 처리("To be announced").
- **동의 없는 사진 미노출**.
