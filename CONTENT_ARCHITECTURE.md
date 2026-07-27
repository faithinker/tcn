# TCN Content Architecture

Updated: 2026-07-27 (구조 정비 슬라이스 반영 - 라우트·데이터 소스 실측 동기화)

Runtime: Astro 7 hybrid on **Cloudflare Workers** (`@astrojs/cloudflare`) - 정적 프리렌더 + 동적 SSR. 배포는 `wrangler deploy` (`.github/workflows/deploy-workers.yml`).

## 1. 원칙

- **콘텐츠 단일 원천 = D1** (`tcn-content`): 세미나·활동 글 전부 `posts` 테이블. 회차 개념 없음 - 미래 `event_date` 글이 곧 "차기 세미나".
- **글 저장 = 즉시 공개**: 공개 페이지가 D1을 SSR로 조회하므로 재빌드·deploy hook 없음.
- **영어 단일 사이트**: `/ko`·`/en` 프리픽스 없음. 구 URL은 `public/_redirects` 정적 301 표가 전담.
- 공개 콘텐츠는 확정 사실만. 미정 정보는 명시적 폴백(`To be announced`).

## 2. 라우트

| 경로                                   | 렌더          | 소스                                                                                |
| -------------------------------------- | ------------- | ----------------------------------------------------------------------------------- |
| `/`                                    | SSR           | D1 (차기/최신 글) + `i18n/content.ts` 카피                                          |
| `/about`                               | SSR           | `content.ts`, `data/organization-milestones.ts` + D1 세미나 병합 연혁               |
| `/about/{founding,declaration,bylaws}` | 정적          | `content.ts`, `invitations.json`                                                    |
| `/people`                              | 정적          | `members.json`                                                                      |
| `/seminars`                            | SSR           | D1 `posts` (예정/지난 = `event_date` 파생)                                          |
| `/seminars/[date]`                     | SSR           | D1 `posts`+`media` (마크다운→HTML, `lib/posts`). 구 `/seminars/p/[id]`는 여기로 301 |
| `/contact`                             | 정적          | `content.ts`                                                                        |
| `/sitemap.xml`                         | SSR           | 정적 경로 + D1 글                                                                   |
| `/admin`, `/admin/**`                  | SSR (noindex) | 작성 앱 (React island + Tiptap→마크다운)                                            |
| `/api/{auth,posts,media}/**`           | SSR           | 인증·CRUD·업로드                                                                    |
| `/media/[...key]`                      | SSR           | R2 스트리밍                                                                         |

## 3. 데이터

- **D1 3테이블** (`migrations/0001_init.sql`): `users`(수동 발급, PBKDF2) · `posts`(title/summary/event_date/address/body-markdown/hero, soft delete) · `media`(R2 키+메타, image/video/document)
- **R2** (`tcn-media`): 원본 파일. 이미지는 업로드 시 브라우저에서 WebP(≤2400px)+EXIF 제거, 서버 재검증.
- **정적 데이터**: `src/data/organization-milestones.ts`(연혁 확정 기록), `members.json`, `invitations.json`, `founding-media.json` (Astro 컬렉션은 members·invitations만)
- **카피**: `src/i18n/content.ts`(페이지 본문 카피) + `ui.ts`(UI 문자열 사전 + `t()`). `i18n/utils.ts`는 `formatDate`만 - 영어 단일이라 언어 분기 없음.

## 4. 권한·알림

- 인증: 서명 세션 쿠키(HMAC, 1일). 계정은 `scripts/create-user.mjs`로 수동 발급 - 회원가입 UI 없음.
- 권한 flat: 인증된 회원 누구나 등록·수정. 삭제는 soft delete만.
- 알림: 글 등록/수정 → `waitUntil`로 Discord webhook + Telegram sendMessage (`lib/notify`). 베스트에포트 - 실패해도 글 무영향. 시크릿: `DISCORD_WEBHOOK`, `TELEGRAM_TOKEN`, `TELEGRAM_TO`.

## 5. 운영

- 로컬: `npm run dev` (wrangler platformProxy로 로컬 D1/R2). 시드: `node scripts/seed-seminar-posts.mjs`. 계정: `node scripts/create-user.mjs <id> <pw> [--remote]`.
- 시크릿: 로컬 `.dev.vars`(SESSION_SECRET), 원격 `wrangler secret put`.
- QA: `npm test`(vitest) · `npm run verify`(3폭 렌더) · `npm run a11y`(Lighthouse) - 기본 경로에 글 상세 포함.
- 레거시 301: `public/_redirects` - `/ko/*`·`/en/*`·구 slug(`2025-laos` 등)·구 회차 허브 전부 영구 이전.
- 슬래시 정규화: SSR 페이지는 미들웨어가 301, 프리렌더 정적 페이지(`/people/` 등)는 Workers Static Assets `drop-trailing-slash`가 **307**로 처리(플랫폼 기본값 수용 — 2026-07-27 결정).

## 6. 보류 콘텐츠 (D1, 코드 수정 대상 아님)

저장소가 아니라 D1 `posts` 행에 있는 미완 항목. `/admin`에서 채우면 즉시 반영되고 배포는 필요 없다.

- **제1차 세미나 (`event_date = 2025-12-26`)** - 전성호 교수 발표 제목·내용 추후 추가 예정. 현재 `summary`는 김원준·전성호 두 발표자를 밝히지만, `body`의 `## Featured presentation` 절은 김원준 발표 하나만 담고 있다. 자료 확보 시 그 절에 전성호 발표를 같은 형식(`### 제목` + `**Presenter:**` + 본문)으로 추가한다.
