# 초문화네트워크 (Transcultural Network, TCN) - 사이트 + 콘텐츠 플랫폼

디지털·AI 시대의 **초문화(transcultural) 현상**을 연구하는 국제 학술단체 초문화네트워크(TCN)의 공식 웹사이트입니다. 소개 사이트에 더해, 지정된 회원이 로그인해 세미나·활동 글을 직접 작성·공개하는 콘텐츠 플랫폼을 포함합니다.

- **현재 배포 (운영)**: https://tcn.faithinker12.workers.dev - Cloudflare **Workers** · 영어 단일 · D1/R2 동적 사이트
- **이전 배포 (구버전)**: https://tcn-ezj.pages.dev - Cloudflare **Pages** · 한국어(`/ko/`)·영어(`/en/`) 정적 사이트. 현재는 갱신되지 않으며 참고용으로만 남아 있습니다.
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
| 창립         | 2025-12-12, 성균관대 명륜캠퍼스 (창립국 15개국)                                   |
| 회장         | 김원준 (Dr. Wonjoon Kim)                                                          |
| 수석부회장   | 전성호 교수                                                                       |
| 제1차 세미나 | 2025-12-26, 라오스 루앙프라방                                                     |
| 제2차 세미나 | 2026-10-30, TCN 본부 (인천 강화)                                                  |

### 공개 페이지 구조

영어 단일 루트 트리입니다. `/about`은 D1 세미나를 연혁에 합치기 위해 SSR이며, 그 밖의 소개 페이지는 정적입니다. 세미나·글 관련 페이지도 D1을 조회하는 SSR입니다.

| 경로                                   | 렌더          | 내용                                                          |
| -------------------------------------- | ------------- | ------------------------------------------------------------- |
| `/`                                    | SSR           | 히어로, 차기 세미나(미래 개최일 글), 미션, 핵심 활동, 최신 글 |
| `/about`                               | SSR           | 소개·연혁 (정적 기관 기록 + D1 세미나)                        |
| `/about/{founding,declaration,bylaws}` | 정적          | 창립총회, 창립 선언문, 정관                                   |
| `/people`                              | 정적          | 임원진·이사 카드 (실명 미확보 시 "추후 공개")                 |
| `/seminars`                            | SSR           | 예정/지난 글 목록 (개최일로 자동 분류)                        |
| `/seminars/[date]`                     | SSR           | 글 상세 - 마크다운 본문, 사진·영상·문서, 주소→지도 링크       |
| `/contact`                             | 정적          | 사무국 연락처                                                 |
| `/sitemap.xml`                         | SSR           | 정적 경로 + 공개 글                                           |
| `/admin`, `/admin/**`                  | SSR (noindex) | 작성자 전용 CMS (로그인 필요)                                 |
| `/api/**`, `/media/[key]`              | SSR           | 인증·CRUD·업로드 / R2 미디어 스트리밍                         |

구 URL(`/ko/*`·`/en/*`·연도-지역 slug·구 회차 허브 등)은 `public/_redirects`에서 새 경로로 301 이전됩니다.

### 콘텐츠 원칙

- **출처 기반만 수록** - 창립 선언문·정관·확정 자료 근거만 사용.
- **추정·창작 금지** - 미확보 정보는 폴백 처리("To be announced").
- **동의 없는 사진 미노출**.

### 콘텐츠 데이터 위치

| 종류                    | 위치                                                           |
| ----------------------- | -------------------------------------------------------------- |
| 세미나·활동 글, 미디어  | Cloudflare **D1** `posts`·`media` (작성자가 `/admin`에서 입력) |
| 연혁 (확정 기관 기록)   | `src/data/organization-milestones.ts` (정적)                   |
| 임원·구성원             | `src/data/members.json`                                        |
| 창립총회 초청장         | `src/data/invitations.json`                                    |
| 페이지 카피 / UI 문자열 | `src/i18n/content.ts` / `src/i18n/ui.ts`                       |

- 새 세미나·글: 개발자 관여 없이 **작성자가 `/admin`에서 직접 등록** → 목록·홈·연혁·상세에 즉시 반영.
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

계층별 실제 구성입니다. 코드는 `src/` 기준 TypeScript 38 · Astro 37 · CSS 3 · React(TSX) 1 파일로, **로직은 TypeScript, 화면은 Astro, 글쓰기 에디터만 React**입니다.

**① 프레임워크·언어**

- **Astro 7.1** - 하이브리드 렌더. 대부분의 소개 페이지는 정적 프리렌더하고, D1 연혁을 포함하는 `/about`과 글·목록·홈·`/admin`·`/api`는 `export const prerender = false`로 SSR.
- **TypeScript 5.9** - DB·인증·미디어·알림 등 핵심 로직 전부. `.astro` 컴포넌트 스크립트도 TS.
- **React 19 + `@astrojs/react` 6** - 어드민 글쓰기 에디터(`PostEditor.tsx`) **단 하나**만 아일랜드로 하이드레이션. 공개 페이지에는 React 번들이 실리지 않음.

**② 런타임·배포 (Cloudflare)**

- **Cloudflare Workers** - `@astrojs/cloudflare 14.1` 어댑터로 SSR을 Worker에서 실행. 공개 페이지·API·어드민이 전부 이 워커 하나.
- 배포는 `wrangler 4` (`wrangler deploy`). `compatibility_flags: ["nodejs_compat"]`.
- 바인딩(`wrangler.jsonc`): `DB`(D1), `MEDIA`(R2), `ASSETS`(정적 산출물). 코드에서는 `import { env } from 'cloudflare:workers'`로 접근.

**③ 데이터·스토리지**

- **Cloudflare D1** (SQLite) `tcn-content` - 3테이블 `users`·`posts`·`media`. 스키마 `migrations/0001_init.sql`. 데이터레이어 `src/lib/db/`.
- **Cloudflare R2** `tcn-media` - 사진·영상·문서 원본. 공개는 `/media/[...key]`로 스트리밍.

**④ 에디터·콘텐츠 렌더**

- **Tiptap 3.28** (`@tiptap/core`·`@tiptap/react`) + **tiptap-markdown 0.9** - 위지윅 작성 → **마크다운으로 저장**.
- **marked 18** - 저장된 마크다운을 공개 상세에서 HTML로 렌더(`src/lib/posts-view.ts`, 링크/이미지 프로토콜 화이트리스트).

**⑤ 인증 (외부 라이브러리 없이 WebCrypto)**

- 비밀번호 **PBKDF2** 해시, 세션은 **HMAC 서명 쿠키**(1일). `src/lib/auth/`. 회원가입 UI 없음 - `scripts/create-user.mjs`로 수동 발급.

**⑥ 스타일·폰트**

- **Tailwind CSS 4** (`@tailwindcss/vite`) + 디자인 토큰(`src/styles/global.css`).
- **Noto Serif KR**(`@fontsource`, 명조 본문·헤드라인) · **Pretendard**(내비·메타). 셀프호스팅.

**⑦ 알림·검증·품질**

- 알림: **Discord 웹훅 · Telegram 봇 API** - 글 등록/수정 시 `waitUntil` 백그라운드 발송(`src/lib/notify/`).
- 검증: `astro check`(타입·스키마) · **Vitest 4**(유닛) · **Playwright**(스크린샷) · **Lighthouse**(접근성).
- 품질·보안 게이트(CI): Codecov · SonarCloud · GitGuardian.

**데이터 흐름**: 공개 페이지(Astro SSR)가 D1을 읽어 렌더 → 작성자는 `/admin`(React+Tiptap)에서 글 작성 → `/api/posts`가 D1에 저장·이미지를 R2에 업로드 → 저장 즉시 공개 + 알림. 전 과정이 하나의 Cloudflare Worker에서 동작합니다.

### 디자인 테마

에디토리얼 학술지 감성 - **50대 후반 이상 독자**를 위한 권위·신뢰·가독성 중심. 전체 스펙은 [`DESIGN.md`](./DESIGN.md).

- **타이포가 정체성** - Noto Serif KR 명조 헤드라인 + 세리프 본문 18px/행간 1.75.
- **단일 강조색** - 딥 인스티튜셔널 블루 `#0b3d6b`. 나머지는 종이 위 잉크.
- **웜 페이퍼 배경**(`#f7f5f0`), 드롭섀도 없음(헤어라인+여백), 터치 타깃 ≥ 48px.

### 디렉터리 구조

```text
tcn/
├── astro.config.mjs         # Astro + Cloudflare 어댑터
├── wrangler.jsonc           # Workers 설정 (D1·R2·assets 바인딩)
├── migrations/
│   └── 0001_init.sql        # D1 스키마 (users·posts·media)
├── .github/workflows/
│   ├── deploy-workers.yml    # check+test+build+wrangler deploy
│   └── ci.yml
├── src/
│   ├── pages/
│   │   ├── index.astro       # 홈 (SSR)
│   │   ├── about/ · people.astro · contact.astro   # 정적 소개
│   │   ├── seminars.astro · seminars/p/[id].astro   # 글 목록·상세 (SSR)
│   │   ├── admin/            # 로그인·글 목록·작성/편집 (SSR, noindex)
│   │   ├── api/              # auth·posts·media 엔드포인트
│   │   ├── media/[...key].ts # R2 미디어 스트리밍
│   │   └── sitemap.xml.ts
│   ├── lib/
│   │   ├── db/               # D1 데이터레이어 (posts·media·users)
│   │   ├── auth/             # PBKDF2·세션·쿠키·가드
│   │   ├── media/            # 업로드 검증·이미지 처리(WebP)
│   │   ├── notify/           # Discord/Telegram 알림
│   │   └── posts-view.ts     # 마크다운 렌더 + 미디어 분류
│   ├── components/
│   │   ├── admin/PostEditor.tsx   # React + Tiptap 에디터
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
│   └── fixtures/
└── DESIGN.md · CONTENT_ARCHITECTURE.md · MEMBERSHIP_FLOW.md
```

### 개발 실행

```bash
npm ci                 # lockfile 기준 의존성 설치
npm run dev            # 개발 서버 (wrangler platformProxy로 로컬 D1/R2 바인딩)
npm run test           # Vitest 유닛 테스트 (커버리지)
npm run check          # astro check (타입·스키마)
npm run build          # dist/ 빌드
npm run audit          # 개발 도구를 포함한 전체 의존성 High 이상 감사
npm run verify         # Playwright 스크린샷 검증 (375/768/1280, 서버 필요)
npm run a11y           # Lighthouse 접근성 (서버 필요)
npm run audit:prod     # 운영 의존성 보안 감사
npm run generate-types # wrangler types (D1/R2 바인딩 타입 생성)
```

> ⚠️ npm 패키지를 바꾼 뒤 dev 서버가 500을 내면 vite 캐시가 스테일된 것입니다. `npx astro dev stop` 후 재시작하세요.

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

`main`에 머지되면 `deploy-workers.yml`이 전체 의존성 감사, check·test·build, D1 Time Travel bookmark와 migration 적용 후 Worker를 배포합니다. 배포 후 readiness smoke가 실패하면 Worker는 직전 버전으로 자동 rollback됩니다. 운영 절차와 복구 기준은 [`docs/operations-runbook.md`](docs/operations-runbook.md)를 따릅니다. 수동 배포는:

```bash
npm run build && npx wrangler deploy
```

원격 시크릿은 `wrangler secret put`으로 설정합니다.

| 시크릿                           | 용도                                               |
| -------------------------------- | -------------------------------------------------- |
| `SESSION_SECRET`                 | 세션 쿠키 서명 (직접 생성: `openssl rand -hex 32`) |
| `DISCORD_WEBHOOK`                | 글 알림 - 디스코드 웹훅 URL                        |
| `TELEGRAM_TOKEN` · `TELEGRAM_TO` | 글 알림 - 봇 토큰 · 채팅 ID                        |

로컬은 `.dev.vars`(`SESSION_SECRET`)를 사용하며 커밋에서 제외합니다. 알림 시크릿이 없으면 해당 채널만 조용히 건너뛰고 글 저장·공개에는 영향이 없습니다.

- **Node**: v22+ 권장.
- 데이터(D1)·미디어(R2) 바인딩은 `wrangler.jsonc`에 정의되어 있습니다.
