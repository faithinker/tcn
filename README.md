# 초문화네트워크 (Transcultural Network, TCN) - 사이트 + 콘텐츠 플랫폼

디지털·AI 시대의 **초문화(transcultural) 현상**을 연구하는 국제 학술단체 초문화네트워크(TCN)의 공식 웹사이트입니다. 소개 사이트에 더해, 지정된 회원이 로그인해 세미나·활동 글을 직접 작성·공개하는 콘텐츠 플랫폼을 포함합니다.

- **현재 배포 (운영)**: [https://tcn.faithinker12.workers.dev](https://tcn.faithinker12.workers.dev) - Cloudflare **Workers** · 영어 단일 · D1/R2 동적 사이트
- **이전 배포 (구버전)**: [https://tcn-ezj.pages.dev](https://tcn-ezj.pages.dev) - Cloudflare **Pages** · 한국어(`/ko/`)·영어(`/en/`) 정적 사이트. 현재는 갱신되지 않으며 참고용으로만 남아 있습니다.
- **성격**: 영어 단일 사이트 + 인증 기반 글쓰기 CMS. 콘텐츠는 Cloudflare **D1**(DB)·**R2**(미디어)에 저장되며, 공개 페이지가 이를 실시간 조회(SSR)합니다. **글을 저장하면 즉시 공개**되고 재빌드가 필요 없습니다.

---

## 1. 콘텐츠 내용

### 단체 소개

| 항목         | 내용                                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| 한글명       | 초문화네트워크                                                                    |
| 영문명       | Transcultural Network                                                             |
| 약칭         | TCN                                                                               |
| 정의         | 국가·민족·언어·문화의 경계를 넘어 새로운 제3의 문화를 창조하는 국제 학술 네트워크 |
| 사무국       | 인천광역시 강화군 강화읍 국화리 286                                               |
| 창립         | 2025-12-12, 성균관대 명륜캠퍼스                                                   |
| 회장         | 김원준 (Dr. Wonjoon Kim)                                                          |
| 수석부회장   | 전성호 교수                                                                       |
| 제1차 세미나 | 2025-12-26, Laos Souphanouvong University                                         |
| 제2차 세미나 | 2026-10-30, TCN 본부 (인천 강화)                                                  |

### 공개 페이지 구조

영어 단일 루트 트리입니다. D1을 읽어야 하는 페이지는 SSR, 그 밖의 소개 페이지는 정적 프리렌더입니다. 라우트별 렌더 방식과 데이터 소스의 단일 원천은 [`CONTENT_ARCHITECTURE.md` §2](./CONTENT_ARCHITECTURE.md#2-라우트)이며, 아래는 그 요약입니다.

- **정적 프리렌더** - `/about/{founding,declaration,bylaws}` · `/people` · `/contact` · `/404`.
- **SSR (공개)** - `/`, `/about`(정적 기관 기록 + D1 세미나 병합 연혁), `/seminars`, `/seminars/[date]`, 공개 Q&A `/questions`·`/questions/new`(noindex)·`/questions/[id]`, `/sitemap.xml`.
- **SSR (noindex)** - `/admin`·`/admin/**` 작성자 전용 CMS(로그인 필요). 글 작성·편집과 Q&A 답변·공개 여부 관리.
- **API·미디어** - `/api/{auth,posts,media,questions}/**`, 헬스체크 `/api/health`·`/api/ready`, `/api/maintenance/media-cleanup`, R2 스트리밍 `/media/[...key]`.

구 URL(`/ko/*`·`/en/*`·연도-지역 slug·구 회차 허브 등)은 `public/_redirects`에서 새 경로로 301 이전됩니다. 구 UUID URL `/seminars/p/[id]`는 SSR 스텁이 개최일 URL로 301합니다.

### 콘텐츠 원칙

- **출처 기반만 수록** - 창립 선언문·정관·확정 자료 근거만 사용.
- **추정·창작 금지** - 미확보 정보는 폴백 처리("To be announced").
- **동의 없는 사진 미노출**.

### 콘텐츠 데이터 위치

| 종류                    | 위치                                                                         |
| ----------------------- | ---------------------------------------------------------------------------- |
| 세미나·활동 글, 미디어  | Cloudflare **D1** `posts`·`media` (작성자가 `/admin`에서 입력)               |
| 공개 Q&A 질문·답변      | Cloudflare **D1** `qna_questions`·`qna_answers` (방문자 제출, 운영자가 답변) |
| 연혁 (확정 기관 기록)   | `src/data/organization-milestones.ts` (정적)                                 |
| 임원·구성원             | `src/data/members.json`                                                      |
| 창립총회 초청장         | `src/data/invitations.json`                                                  |
| 페이지 카피 / UI 문자열 | `src/i18n/content.ts` / `src/i18n/ui.ts`                                     |

- 새 세미나·글: 개발자 관여 없이 **작성자가 `/admin`에서 직접 등록** → 목록·홈·연혁·상세에 즉시 반영.
- 공개 Q&A: 방문자가 `/questions/new`에서 제출(Turnstile·레이트리밋 통과 시) → 운영자가 `/admin/questions`에서 답변·숨김 처리. 새 질문은 알림이 가지 않고 어드민 내비의 대기 건수 배지로만 드러납니다.
- 소개 페이지 카피 수정: `src/i18n/content.ts`.

### 관리자 세미나 글 등록 시 영향 범위

`/admin`에서 세미나를 저장하면 별도 배포 없이 즉시 공개됩니다.

- 개최일은 실제 존재하는 날짜여야 하며(예: `2026-11-31` 불가), 기존 마지막 세미나보다 뒤여야 합니다.
- 회차와 공개 URL(`/seminars/YYYY-MM-DD`)은 개최일순으로 자동 생성됩니다.
- 홈은 미래 세미나 중 개최일이 가장 가까운 한 건을 차기 세미나로 표시합니다.

| 대상                  | 반영 내용                                    |
| --------------------- | -------------------------------------------- |
| 홈 `/`                | 가장 가까운 차기 세미나와 최근 세미나 표시   |
| 세미나 `/seminars`    | 예정·지난 세미나 목록에 자동 분류            |
| 연혁 `/about#history` | 기관 연혁에 세미나 항목 추가                 |
| 상세 페이지           | 날짜 기반 공개 URL과 본문·미디어 페이지 생성 |

또한 sitemap과 관리자 글 목록이 갱신되며, 설정된 경우 Discord·Telegram 알림이 발송됩니다.

예: 제2차가 `2026-10-30`, 제3차가 `2026-11-30`이면 홈에는 제2차가 계속 표시됩니다. `2026-10-31`부터 제3차가 차기 세미나로 표시됩니다.

---

## 2. 개발 내용

### 기술 스택 구성

계층별 실제 구성입니다. **로직은 TypeScript, 화면은 Astro, 글쓰기 에디터만 React**입니다. `src/` 파일 수는 TypeScript(절반 가까이가 `*.test.ts`) > Astro > React(TSX, 어드민 에디터 전용) > CSS 순이며, 정확한 수치는 문서보다 `find src -type f -name '*.ts' | wc -l` 같은 실측이 앞섭니다.

**① 프레임워크·언어**

- **Astro 7.1** - 하이브리드 렌더. 대부분의 소개 페이지는 정적 프리렌더하고, D1 연혁을 포함하는 `/about`과 글·목록·홈·`/admin`·`/api`는 `export const prerender = false`로 SSR.
- **TypeScript 5.9** - DB·인증·미디어·알림 등 핵심 로직 전부. `.astro` 컴포넌트 스크립트도 TS.
- **React 19 + `@astrojs/react` 6** - 어드민 글쓰기 에디터(`PostEditor.tsx`) **단 하나**만 아일랜드로 하이드레이션(`client:load`). 컨테이너인 `PostEditor`가 상태·저장을 쥐고 표현 컴포넌트(`BodyEditor`·`MediaManager`·`PostFields`·`PublishBar`·`ReadinessAside`)를 합성합니다. 공개 페이지에는 React 번들이 실리지 않음.

**② 런타임·배포 (Cloudflare)**

- **Cloudflare Workers** - `@astrojs/cloudflare 14.1` 어댑터로 SSR을 Worker에서 실행. 공개 페이지·API·어드민이 전부 이 워커 하나.
- 배포는 `wrangler 4` (`wrangler deploy`). `compatibility_flags: ["nodejs_compat"]`.
- 바인딩(`wrangler.jsonc`): `DB`(D1), `MEDIA`(R2), `ASSETS`(정적 산출물). 코드에서는 `import { env } from 'cloudflare:workers'`로 접근.

**③ 데이터·스토리지**

- **Cloudflare D1** (SQLite) `tcn-content` - 10테이블. 콘텐츠 축은 `users`·`posts`·`media`이고, 여기에 운영용 `media_cleanup_queue`·`auth_rate_limits`와 공개 Q&A 5종(`qna_questions`·`qna_answers`·`qna_audit_events`·`qna_rate_limits`·`qna_turnstile_tokens`)이 더해집니다. 스키마는 `migrations/*.sql` 6개 - 초기 `0001_init.sql` 이후는 기존 Worker와 호환되는 additive 변경만(`posts.revision`, `users.session_version` 컬럼 추가 포함). 데이터레이어 `src/lib/db/`.
- **Cloudflare R2** `tcn-media` - 사진·영상·문서 원본. 공개는 `/media/[...key]`로 스트리밍.

**④ 에디터·콘텐츠 렌더**

- **Tiptap 3.28** (`@tiptap/core`·`@tiptap/react`) + **tiptap-markdown 0.9** - 위지윅 작성 → **마크다운으로 저장**.
- **marked 18** - 저장된 마크다운을 공개 상세에서 HTML로 렌더(`src/lib/posts/view.ts`, 링크/이미지 프로토콜 화이트리스트).

**⑤ 인증 (외부 라이브러리 없이 WebCrypto)**

- 비밀번호 **PBKDF2** 해시, 세션은 **HMAC 서명 쿠키**(1일). `src/lib/auth/`. 회원가입 UI 없음 - `scripts/create-user.mjs`로 수동 발급.

**⑥ 스타일·폰트**

- **Tailwind CSS 4** (`@tailwindcss/vite`) + 디자인 토큰(`src/styles/global.css`).
- 웹폰트는 **Pretendard**(가변 dynamic-subset, 셀프호스팅) 하나뿐입니다. 세리프 본문·헤드라인은 웹폰트를 싣지 않고 시스템 Georgia 스택(`--font-serif`, `src/styles/global.css:30-31`)을 씁니다. 재도입 조건과 Fontsource 서브셋 함정은 `src/styles/fonts.css` 주석에 남겨 두었습니다.

**⑦ 알림·검증·품질**

- 알림: **Discord 웹훅 · Telegram 봇 API** - 글 등록/수정 시 `waitUntil` 백그라운드 발송(`src/lib/notify/`).
- 검증: `astro check`(타입·스키마) · **Vitest 4**(유닛) · **Playwright**(스크린샷) · **Lighthouse**(접근성).
- 품질 게이트(CI): Codecov(커버리지 업로드) · SonarCloud(PR은 `ci.yml`, main 기준선은 `sonar-main.yml`).

**데이터 흐름**: 공개 페이지(Astro SSR)가 D1을 읽어 렌더 → 작성자는 `/admin`(React+Tiptap)에서 글 작성 → `/api/posts`가 D1에 저장·이미지를 R2에 업로드 → 저장 즉시 공개 + 알림. 전 과정이 하나의 Cloudflare Worker에서 동작합니다.

### 디자인 테마

에디토리얼 학술지 감성 - **50대 후반 이상 독자**를 위한 권위·신뢰·가독성 중심. 세리프 서사에 단일 강조색(딥 인스티튜셔널 블루 `#0b3d6b`)과 웜 페이퍼 배경을 얹고, 드롭섀도 대신 헤어라인과 여백으로 층을 만듭니다.

타이포·색·간격·모션 토큰의 단일 원천은 [`DESIGN.md`](./DESIGN.md)입니다. 여기서 되풀이하지 않습니다.

### 디렉터리 구조

```text
tcn/
├── astro.config.mjs         # Astro + Cloudflare 어댑터
├── wrangler.jsonc           # Workers 설정 (D1·R2·assets 바인딩)
├── migrations/
│   ├── 0001_init.sql        # D1 스키마 (users·posts·media)
│   └── 0002~0006_*.sql      # additive: unique event_date, 미디어 청소 큐, 인증 하드닝, revision, Q&A
├── .github/workflows/
│   ├── ci.yml                # PR 게이트 (브라우저 게이트 + audit·test·check·build·Sonar·Codecov)
│   ├── deploy-workers.yml    # main 머지 시 migration + deploy + 버전 전파 대기 + smoke
│   ├── sonar-main.yml        # main push Sonar 분석 (New Code 기준선 유지)
│   └── claude-review.yml     # PR 자동 코드 리뷰
├── src/
│   ├── pages/
│   │   ├── index.astro       # 홈 (SSR)
│   │   ├── about/ · people.astro · contact.astro   # 정적 소개
│   │   ├── seminars.astro · seminars/[date].astro   # 글 목록·상세 (SSR)
│   │   ├── seminars/p/[id].astro   # 구 UUID URL → 개최일 URL 301 스텁
│   │   ├── questions/        # 공개 Q&A 목록·작성·상세 (SSR)
│   │   ├── admin/            # 로그인·글·질문 관리 (SSR, noindex)
│   │   ├── api/              # auth·posts·media·questions·health·ready·maintenance
│   │   ├── media/[...key].ts # R2 미디어 스트리밍
│   │   └── sitemap.xml.ts
│   ├── lib/
│   │   ├── db/               # D1 데이터레이어 (posts·media·users)
│   │   ├── auth/             # PBKDF2·세션·쿠키·가드
│   │   ├── media/            # 업로드 검증·이미지 처리(WebP)
│   │   ├── notify/           # Discord/Telegram 알림 (글 등록·수정 전용)
│   │   ├── posts/            # view.ts 마크다운 렌더 + payload 검증
│   │   ├── qna/              # Q&A 저장소·페이로드·Turnstile·레이트리밋·CSRF
│   │   ├── seminars/         # 회차·개최일 URL 파생
│   │   └── routes/           # 정적 경로 목록 (sitemap·검증 공용)
│   ├── components/
│   │   ├── admin/            # PostEditor.tsx(React+Tiptap 컨테이너) + 표현 컴포넌트 5종
│   │   ├── qna/              # 목록·페이지네이션·상태 배지 (Astro)
│   │   └── seminars/CommunityPost.astro   # 글 상세 본문 (라우트가 prop 주입)
│   ├── data/                 # organization-milestones.ts, members.json, invitations.json, founding-media.json
│   ├── i18n/                 # content.ts, ui.ts, utils.ts
│   └── styles/global.css     # 디자인 토큰 + Tailwind
├── public/
│   ├── _headers · _redirects · robots.txt · 파비콘·OG
├── scripts/
│   ├── create-user.mjs       # 작성자 계정 발급 (회원가입 UI 없음)
│   ├── seed-seminar-posts.mjs # 세미나 글 시드 (멱등)
│   ├── verify.mjs · motion.mjs · a11y.mjs   # 브라우저 검증
│   ├── verify-admin-authoring.mjs · verify-founding-media.mjs · verify-seminar-carousel.mjs
│   ├── verify-qna-d1.mjs     # Q&A D1 제약 검증 (CI 게이트)
│   └── fixtures/
├── docs/operations-runbook.md   # 운영·복구 절차
└── DESIGN.md · CONTENT_ARCHITECTURE.md · MEMBERSHIP_FLOW.md · IDEA.md · AGENTS.md · CHANGELOG.md
```

### 개발 실행

```bash
npm ci                 # lockfile 기준 의존성 설치
npm run dev            # 개발 서버 (wrangler platformProxy로 로컬 D1/R2 바인딩)
npm run preview        # 빌드 산출물 미리보기 (build 이후)
npm run preview:mobile # 4341 포트 dev 서버 (같은 네트워크의 실기기 확인용)
npm run test           # Vitest 유닛 테스트 (커버리지)
npm run check          # astro check (타입·스키마)
npm run build          # dist/ 빌드
npm run format         # Prettier 일괄 정리 (검사만: format:check)
npm run audit          # 개발 도구를 포함한 전체 의존성 High 이상 감사
npm run audit:prod     # 운영 의존성 보안 감사
npm run generate-types # wrangler types (D1/R2 바인딩 타입 생성)
```

브라우저 검증 - 전부 로컬 서버가 떠 있어야 하고, `motion`만 빼고 `ci.yml` 게이트입니다.

```bash
npm run verify                  # Playwright 스크린샷 검증 (375/768/1280)
npm run verify:admin            # 어드민 작성 플로 계약 검증
npm run verify:founding-media   # 창립 미디어 갤러리 렌더 검증
npm run verify:seminar-carousel # 세미나 캐러셀 상호작용 검증
npm run a11y                    # Lighthouse 접근성
npm run motion                  # 모션·리듀스드모션 (CI 게이트 아님, 로컬 확인용)
```

D1 스키마 검증 - 서버 없이 `wrangler`로 로컬 D1을 직접 두드립니다. `ci.yml` 게이트입니다.

```bash
npm run test:qna:d1    # Q&A 유니크·CHECK 제약이 실제로 거부하는지 확인
```

> ⚠️ npm 패키지를 바꾼 뒤 dev 서버가 500을 내면 vite 캐시가 스테일된 것입니다. Astro CLI에는 `stop` 명령이 없으니 dev 프로세스를 직접 끝내고(포그라운드면 Ctrl-C, 아니면 해당 PID에 `kill`) 다시 `npm run dev` 하세요.

### AI 에이전트 설정

Codex CLI로 이 저장소를 작업할 때는 프로필을 지정해서 실행합니다.

```bash
codex --profile tcn
```

저장소 로컬 설정은 `.codex/config.toml`에 있습니다. 이 프로젝트가 유일한 웹·Cloudflare 저장소이므로 Cloudflare MCP 5종(`cloudflare-api`·`docs`·`bindings`·`builds`·`observability`)을 켜고, Apple 계열 도구(`apple-docs`·`XcodeBuildMCP`·`mobile-mcp`)는 전역에 남겨둔 채 이 저장소에서만 끕니다. Spec Kit·프로젝트 로컬 Impeccable과 겹치는 gstack 스킬도 여기서 비활성화합니다.

Claude Code는 `CLAUDE.md`가 `AGENTS.md`를 임포트해 같은 워크플로 정책을 따릅니다.

### 콘텐츠 운영 (작성자 계정·시드)

회원가입 UI가 없습니다. 최고관리자가 계정을 수동 발급합니다.

```bash
# 작성자 계정 발급 (--remote 없으면 로컬 D1)
node scripts/create-user.mjs <아이디> <비번> --remote --display "이름"

# 세미나 글 시드 (멱등)
node scripts/seed-seminar-posts.mjs --remote
```

작성자는 `/admin`에서 로그인 → 글 작성(제목·개최일·주소·본문) → 사진·영상·문서 드래그앤드롭 업로드(이미지는 WebP 자동 변환) → 저장 시 즉시 공개됩니다. 권한은 flat(인증된 회원 누구나 등록·수정), 삭제는 soft delete입니다.

### 배포

`main`에 머지되면 `deploy-workers.yml`이 전체 의존성 감사, check·test·build, D1 Time Travel bookmark와 migration 적용 후 Worker를 배포합니다. 배포 뒤 순서가 핵심입니다.

1. **버전 전파 대기** - `wrangler deploy`가 보고한 version id가 실제로 트래픽 100%를 받을 때까지 `wrangler deployments status`를 5초 간격 12회 폴링합니다. 그 안에 도달하지 못하거나 deploy 출력에 version id가 없으면 워크플로를 실패시킵니다.
2. **운영 smoke** - 그 다음에야 `/`, `/api/health`, `/api/ready`를 검사합니다.
3. **자동 rollback** - smoke가 실패하면 `wrangler rollback`으로 직전 버전으로 되돌립니다.

1번이 없으면 smoke가 이전 버전에 닿고도 초록이 됩니다. 2026-07-29 배포가 그렇게 통과했고(Q&A 시크릿 누락) 다음 배포가 롤백됐습니다. 운영 절차와 복구 기준은 [`docs/operations-runbook.md`](docs/operations-runbook.md)를 따릅니다. 수동 배포는:

```bash
npm run build && npx wrangler deploy
```

원격 시크릿은 개별 설정이면 `wrangler secret put <이름>`, 여러 건을 한 번에 맞출 때는 gitignore된 `.dev.vars.production`을 만들어 `npx wrangler secret bulk .dev.vars.production`으로 넣습니다(운영은 이 경로를 씁니다). `.gitignore`가 `.dev.vars`와 `.dev.vars.*`를 모두 제외하므로 커밋에 섞이지 않습니다.

| 시크릿                           | 용도                                               |
| -------------------------------- | -------------------------------------------------- |
| `SESSION_SECRET`                 | 세션 쿠키 서명 (직접 생성: `openssl rand -hex 32`) |
| `TURNSTILE_SITE_KEY`             | Q&A 작성 폼의 공개 Turnstile site key              |
| `TURNSTILE_SECRET_KEY`           | Q&A Siteverify Worker secret                       |
| `QNA_TURNSTILE_HOSTNAMES`        | Siteverify exact hostname allowlist (쉼표 구분)    |
| `QNA_RATE_LIMIT_SECRET`          | 원 IP 비저장 HMAC rate-limit key                   |
| `DISCORD_WEBHOOK`                | 글 알림 - 디스코드 웹훅 URL                        |
| `TELEGRAM_TOKEN` · `TELEGRAM_TO` | 글 알림 - 봇 토큰 · 채팅 ID                        |

로컬은 `.dev.vars`를 사용하며 커밋에서 제외합니다. Turnstile의 공식 dummy key 응답에는
hostname/action이 없으므로, 단위·CI 테스트는 Siteverify를 mock합니다. 실제 로컬 제출 검증에는
localhost를 허용한 전용 widget과 `QNA_TURNSTILE_HOSTNAMES=localhost`를 사용합니다. Q&A 보안
설정이 하나라도 없거나 hostname/action 검증이 실패하면 질문 생성과 readiness는 fail closed
됩니다. 알림 시크릿이 없으면 해당 채널만 조용히 건너뛰고 글 저장·공개에는 영향이 없습니다.

- **Node**: v22+ 권장.
- 데이터(D1)·미디어(R2) 바인딩은 `wrangler.jsonc`에 정의되어 있습니다.
- `PUBLIC_MEMBERSHIP_FORM_URL`은 시크릿이 아니라 공개 환경변수입니다(`.env.example`). 비어 두면 `/contact`의 가입 신청 링크 자리에 "Application form coming soon" 비활성 표시가 대신 노출됩니다.
