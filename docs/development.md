# 개발 가이드

기술 스택, 디렉터리 구조, 로컬 실행·검증 명령, AI 에이전트 설정을 모았습니다. 프로젝트 개요는 [`README.md`](../README.md), 배포는 [`deployment.md`](./deployment.md)를 보세요.

## 기술 스택

계층별 실제 구성입니다. **로직은 TypeScript, 화면은 Astro, 글쓰기 에디터만 React**입니다. 정확한 버전은 `package.json`이 단일 원천이라 아래에는 메이저만 적습니다.

**① 프레임워크·언어**

- **Astro 7** - 하이브리드 렌더. 대부분의 소개 페이지는 정적 프리렌더하고, D1 연혁을 포함하는 `/about`과 글·목록·홈·`/admin`·`/api`는 `export const prerender = false`로 SSR.
- **TypeScript 6** - DB·인증·미디어·알림 등 핵심 로직 전부. `.astro` 컴포넌트 스크립트도 TS. `astro check`가 TS 7.0을 거부(`does not currently support TypeScript 7.0`)하므로 6 계열을 유지합니다. Astro가 TS 7.1+ 지원을 내놓으면 올립니다.
- **React 19 + `@astrojs/react` 7** - 어드민 글쓰기 에디터(`PostEditor.tsx`) **단 하나**만 아일랜드로 하이드레이션(`client:load`). 컨테이너인 `PostEditor`가 상태·저장을 쥐고 표현 컴포넌트(`BodyEditor`·`MediaManager`·`PostFields`·`PublishBar`·`ReadinessAside`)를 합성합니다. 공개 페이지에는 React 번들이 실리지 않음.

**② 런타임·배포 (Cloudflare)**

- **Cloudflare Workers** - `@astrojs/cloudflare` 어댑터로 SSR을 Worker에서 실행. 공개 페이지·API·어드민이 전부 이 워커 하나.
- 배포는 `wrangler 4` (`wrangler deploy`). `compatibility_flags: ["nodejs_compat"]`.
- 빌드·테스트 런타임은 **Node.js 26**이고 버전의 기준은 `.nvmrc`입니다. CI 워크플로(`ci.yml`·`deploy-workers.yml`·`sonar-main.yml`)가 이 파일을 읽고, `package.json`의 `engines`도 `>=26 <27`로 맞춰져 있습니다. Astro 7의 최소 요구는 Node 22.12입니다.
- 바인딩(`wrangler.jsonc`): `DB`(D1), `MEDIA`(R2), `ASSETS`(정적 산출물). 코드에서는 `import { env } from 'cloudflare:workers'`로 접근.

**③ 데이터·스토리지**

- **Cloudflare D1** (SQLite) `tcn-content` - 스키마는 `migrations/*.sql`, `0001_init.sql` 이후는 기존 Worker와 호환되는 additive 변경만. 테이블 구성은 [`CONTENT_ARCHITECTURE.md` §3](../CONTENT_ARCHITECTURE.md#3-데이터). 데이터레이어 `src/lib/db/`.
- **Cloudflare R2** `tcn-media` - 사진·영상·문서 원본. 공개는 `/media/[...key]`로 스트리밍.

**④ 에디터·콘텐츠 렌더**

- **Tiptap 3** (`@tiptap/core`·`@tiptap/react`) + **tiptap-markdown** - 위지윅 작성 → **마크다운으로 저장**.
- **marked** - 저장된 마크다운을 공개 상세에서 HTML로 렌더(`src/lib/posts/view.ts`, 링크/이미지 프로토콜 화이트리스트).

**⑤ 인증 (외부 라이브러리 없이 WebCrypto)**

- 비밀번호 **PBKDF2** 해시, 세션은 **HMAC 서명 쿠키**(1일). `src/lib/auth/`. 권한·알림 규칙은 [`CONTENT_ARCHITECTURE.md` §4](../CONTENT_ARCHITECTURE.md#4-권한알림), 계정 발급은 [`content-operations.md`](./content-operations.md).

**⑥ 스타일·폰트**

- **Tailwind CSS 4** (`@tailwindcss/vite`) + 디자인 토큰(`src/styles/global.css`). 토큰·타이포·색·간격의 단일 원천은 [`DESIGN.md`](../DESIGN.md).
- 웹폰트는 **Pretendard**(가변 dynamic-subset, 셀프호스팅) 하나뿐입니다. 세리프 본문·헤드라인은 웹폰트를 싣지 않고 시스템 Georgia 스택(`--font-serif`, `src/styles/global.css:30-31`)을 씁니다. 재도입 조건과 Fontsource 서브셋 함정은 `src/styles/fonts.css` 주석에 남겨 두었습니다.

**⑦ 알림·검증·품질**

- 알림: **Discord 웹훅 · Telegram 봇 API** - 글 등록/수정 시 `waitUntil` 백그라운드 발송(`src/lib/notify/`).
- 검증: `astro check`(타입·스키마) · **Vitest**(유닛) · **Playwright**(스크린샷) · **Lighthouse**(접근성).
- 품질 게이트(CI): Codecov(커버리지 업로드) · SonarCloud(PR은 `ci.yml`, main 기준선은 `sonar-main.yml`).

**데이터 흐름**: 공개 페이지(Astro SSR)가 D1을 읽어 렌더 → 작성자는 `/admin`(React+Tiptap)에서 글 작성 → `/api/posts`가 D1에 저장·이미지를 R2에 업로드 → 저장 즉시 공개 + 알림. 전 과정이 하나의 Cloudflare Worker에서 동작합니다.

## 디렉터리 구조

최상위와 `src/lib`까지만 적습니다. 그 아래는 파일명이 곧 역할이라 문서로 중복하지 않습니다.

```text
tcn/
├── astro.config.mjs      # Astro + Cloudflare 어댑터 (site: https://thetcn.org)
├── wrangler.jsonc        # Workers 설정 (D1·R2·assets 바인딩)
├── migrations/           # D1 스키마 (0001_init + additive 변경)
├── .github/workflows/    # ci.yml · deploy-workers.yml · sonar-main.yml · claude-review.yml
├── src/
│   ├── pages/            # 라우트 (공개·admin·api·media·sitemap) - 목록은 CONTENT_ARCHITECTURE §2
│   ├── layouts/ · components/   # 레이아웃과 UI (components/admin = React+Tiptap 에디터)
│   ├── lib/
│   │   ├── db/           # D1 데이터레이어 (posts·media·users)
│   │   ├── auth/         # PBKDF2·세션·쿠키·가드·로그인 레이트리밋
│   │   ├── qna/          # Q&A 저장소·Turnstile·레이트리밋·CSRF
│   │   ├── posts/        # 마크다운 렌더 + payload 검증
│   │   ├── seminars/     # 회차·개최일 URL 파생
│   │   ├── media/        # 업로드 검증·이미지 처리(WebP)
│   │   ├── notify/       # Discord/Telegram 알림 (글 등록·수정 전용)
│   │   ├── crypto/       # 공용 암호 헬퍼
│   │   └── routes/       # API 라우트 핸들러 테스트
│   ├── data/ · i18n/     # 정적 데이터(JSON·TS) · 페이지 카피와 UI 문자열
│   ├── middleware.ts     # 슬래시 정규화 301 + Q&A 응답 보안 헤더
│   └── styles/global.css # 디자인 토큰 + Tailwind
├── public/               # _headers · _redirects · robots.txt · 파비콘·OG
├── scripts/              # create-user·seed-seminar-posts + 브라우저·D1 검증 스크립트
├── docs/                 # 개발·콘텐츠·배포 가이드, 운영 런북, 설계 기록
└── DESIGN.md · CONTENT_ARCHITECTURE.md · MEMBERSHIP_FLOW.md · IDEA.md · AGENTS.md · CHANGELOG.md
```

## 로컬 실행

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

로컬은 `.dev.vars`로 시크릿을 주입하며 커밋에서 제외합니다. 필요한 키는 `.env.example`과 [`deployment.md`](./deployment.md)의 시크릿 표를 보세요.

관리자 로그인에는 Turnstile 챌린지가 걸려 있습니다. 브라우저로 직접 로그인할 때는 `.dev.vars`의 Turnstile 키(localhost를 허용한 위젯)로 통과하면 되고, `npm run verify:admin`처럼 헤드리스 브라우저가 로그인 폼을 밟을 때는 `.dev.vars`에 `LOGIN_CHALLENGE=off`를 두세요(localhost 요청에만 효력이 있습니다).

> ⚠️ npm 패키지를 바꾼 뒤 dev 서버가 500을 내면 vite 캐시가 스테일된 것입니다. Astro CLI에는 `stop` 명령이 없으니 dev 프로세스를 직접 끝내고(포그라운드면 Ctrl-C, 아니면 해당 PID에 `kill`) 다시 `npm run dev` 하세요.

## 브라우저 검증

전부 로컬 서버가 떠 있어야 하고, `motion`만 빼고 `ci.yml` 게이트입니다.

```bash
npm run verify                  # Playwright 스크린샷 검증 (375/768/1280)
npm run verify:admin            # 어드민 작성 플로 계약 검증
npm run verify:founding-media   # 창립 미디어 갤러리 렌더 검증
npm run verify:seminar-carousel # 세미나 캐러셀 상호작용 검증
npm run a11y                    # Lighthouse 접근성
npm run motion                  # 모션·리듀스드모션 (CI 게이트 아님, 로컬 확인용)
```

D1 스키마 검증은 서버 없이 `wrangler`로 로컬 D1을 직접 두드립니다. `ci.yml` 게이트입니다.

```bash
npm run test:qna:d1    # Q&A 유니크·CHECK 제약이 실제로 거부하는지 확인
npm run test:roles:d1  # 역할 마이그레이션의 백필·기본값·CHECK 제약 확인
```

## AI 에이전트 설정

Codex CLI로 이 저장소를 작업할 때는 프로필을 지정해서 실행합니다. 작성자 머신의 `~/.zshrc`에는 작업 디렉터리에 따라 `codex`에 `--profile web`(이 저장소) 또는 `--profile ios`(iOS 프로젝트)를 자동으로 붙이는 함수가 있으므로 따로 붙이지 않습니다(중복 지정하면 오류). 함수가 없는 환경에서는 직접 붙입니다.

```bash
codex --profile web
```

MCP 설정은 저장소 로컬 `.codex/config.toml`에 있습니다. 웹 전용 저장소라 Cloudflare·Astro 문서 MCP는 여기서만 켜고, iOS·Figma·Jira·Postman 계열은 여기서 꺼 둡니다. 스킬과 Cloudflare 플러그인 설정은 프로젝트 설정에서 무시되므로 `~/.codex/web.config.toml` 프로필에 두며(iOS용은 `ios.config.toml`), 이 파일은 머신 로컬이라 저장소에 포함되지 않습니다. 반대로 iOS 프로젝트에서는 웹·인프라 도구가 전역 설정에서 꺼져 있어 로드되지 않습니다. 켜고 끄는 도구의 전체 목록과 Claude Code 쪽 설정은 [`AGENTS.md`](../AGENTS.md)의 "Tool scope (web vs iOS)" 섹션이 단일 원천이며, Claude Code는 `CLAUDE.md`가 `AGENTS.md`를 임포트해 같은 정책을 따릅니다.
