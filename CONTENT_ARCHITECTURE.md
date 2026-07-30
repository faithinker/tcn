# TCN Content Architecture

Updated: 2026-07-30 (공개 Q&A 라우트·D1 10테이블·Q&A 보안 설정 실측 동기화)

Runtime: Astro 7 hybrid on **Cloudflare Workers** (`@astrojs/cloudflare`) - 정적 프리렌더 + 동적 SSR. 배포는 `wrangler deploy` (`.github/workflows/deploy-workers.yml`).

## 1. 원칙

- **콘텐츠 단일 원천 = D1** (`tcn-content`): 세미나·활동 글 전부 `posts` 테이블. 회차 개념 없음 - 미래 `event_date` 글이 곧 "차기 세미나".
- **글 저장 = 즉시 공개**: 공개 페이지가 D1을 SSR로 조회하므로 재빌드·deploy hook 없음.
- **영어 단일 사이트**: `/ko`·`/en` 프리픽스 없음. 구 URL은 `public/_redirects` 정적 301 표가 전담.
- 공개 콘텐츠는 확정 사실만. 미정 정보는 명시적 폴백(`To be announced`).

## 2. 라우트

| 경로                                        | 렌더           | 소스                                                                                |
| ------------------------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| `/`                                         | SSR            | D1 (차기/최신 글) + `i18n/content.ts` 카피                                          |
| `/about`                                    | SSR            | `content.ts`, `data/organization-milestones.ts` + D1 세미나 병합 연혁               |
| `/about/{founding,declaration,bylaws}`      | 정적           | `content.ts`, `invitations.json`                                                    |
| `/people`                                   | 정적           | `members.json`                                                                      |
| `/seminars`                                 | SSR            | D1 `posts` (예정/지난 = `event_date` 파생)                                          |
| `/seminars/[date]`                          | SSR            | D1 `posts`+`media` (마크다운→HTML, `lib/posts`). 구 `/seminars/p/[id]`는 여기로 301 |
| `/contact`                                  | 정적           | `content.ts` (+`PUBLIC_MEMBERSHIP_FORM_URL` 설정 시 가입 CTA)                       |
| `/questions`                                | SSR            | D1 `qna_questions`+`qna_answers` 공개 목록 (`Cache-Control: no-store`)              |
| `/questions/new`                            | SSR (noindex)  | 질문 작성 폼 (`TURNSTILE_SITE_KEY` 위젯)                                            |
| `/questions/[id]`                           | SSR            | D1 질문 상세 + 공식 답변. noindex는 not-found·조회실패일 때만                       |
| `/404`                                      | 정적 (noindex) | 하드코딩 카피                                                                       |
| `/sitemap.xml`                              | SSR            | 정적 경로(`/questions` 포함) + D1 글                                                |
| `/admin`, `/admin/**`                       | SSR (noindex)  | 작성 앱 (React island + Tiptap→마크다운)                                            |
| `/admin/questions`, `/admin/questions/[id]` | SSR (noindex)  | Q&A 콘솔 - 대기/답변/숨김 탭, 답변 작성·공개 여부 전환                              |
| `/api/{auth,posts,media}/**`                | SSR            | 인증·CRUD·업로드                                                                    |
| `/api/questions`                            | SSR            | POST 질문 생성 (Turnstile 검증 + 레이트리밋). 공개 조회는 페이지가 직접 D1          |
| `/api/questions/[id]/answer`                | SSR            | PUT 공식 답변 upsert (세션+동일출처+CSRF, `expectedRevision` 낙관적 락)             |
| `/api/questions/[id]/visibility`            | SSR            | PATCH 공개/숨김 전환 (같은 가드)                                                    |
| `/api/health`, `/api/ready`                 | SSR            | liveness / 바인딩·시크릿 readiness (하나라도 없으면 503)                            |
| `/api/maintenance/media-cleanup`            | SSR            | POST 고아 R2 키 정리 - 인증 필요, 멱등 (`media_cleanup_queue`)                      |
| `/media/[...key]`                           | SSR            | R2 스트리밍                                                                         |

## 3. 데이터

- **D1 10테이블** (`migrations/*.sql` 6개, `0001_init.sql` 이후는 additive만):
  - 콘텐츠: `users`(수동 발급, PBKDF2, `session_version`으로 일괄 세션 무효화) · `posts`(title/summary/event_date/address/body-markdown/hero, soft delete, `revision` 낙관적 락) · `media`(R2 키+메타, image/video/document)
  - 운영: `media_cleanup_queue`(고아 R2 키 큐) · `auth_rate_limits`(로그인 시도 제한)
  - 공개 Q&A: `qna_questions` · `qna_answers` · `qna_audit_events`(답변·공개여부 변경 감사) · `qna_rate_limits` · `qna_turnstile_tokens`(토큰 재사용 차단)
- **R2** (`tcn-media`): 원본 파일. 이미지는 업로드 시 브라우저에서 WebP(≤2400px)+EXIF 제거, 서버 재검증.
- **정적 데이터**: `src/data/organization-milestones.ts`(연혁 확정 기록), `members.json`, `invitations.json`, `founding-media.json` (Astro 컬렉션은 members·invitations만)
- **카피**: `src/i18n/content.ts`(페이지 본문 카피) + `ui.ts`(UI 문자열 사전 + `t()`). `i18n/utils.ts`는 `formatDate`만 - 영어 단일이라 언어 분기 없음.

## 4. 권한·알림

- 인증: 서명 세션 쿠키(HMAC, 1일). 계정은 `scripts/create-user.mjs`로 수동 발급 - 회원가입 UI 없음.
- 권한 flat: 인증된 회원 누구나 글 등록·수정에 더해 Q&A 답변 작성·공개 여부 전환까지 할 수 있다. 별도 admin 역할 컬럼은 없다. 삭제는 soft delete만.
- Q&A 변경 가드(`lib/qna/security.ts` `requireAdminMutation`): 세션 + 동일 출처 `Origin` + `sec-fetch-site` + CSRF 토큰을 전부 요구하고, `expectedRevision` 불일치는 409. 모든 변경은 `qna_audit_events`에 `answer_created`/`answer_updated`/`question_hidden`/`question_restored`로 남는다.
- 알림: 글 등록/수정 → `waitUntil`로 Discord webhook + Telegram sendMessage (`lib/notify`). 베스트에포트 - 실패해도 글 무영향. 시크릿: `DISCORD_WEBHOOK`, `TELEGRAM_TOKEN`, `TELEGRAM_TO`.
- **Q&A 질문 제출은 알림을 보내지 않는다** - 의도된 설계다. `lib/notify`는 `api/posts`에서만 호출된다. 운영자는 어드민 내비의 대기 질문 건수 배지로만 새 질문을 인지한다.
- 설정 인벤토리(`.env.example`): 위 알림 시크릿 + `SESSION_SECRET` + Q&A 4종 `TURNSTILE_SITE_KEY`·`TURNSTILE_SECRET_KEY`·`QNA_TURNSTILE_HOSTNAMES`·`QNA_RATE_LIMIT_SECRET` + `PUBLIC_MEMBERSHIP_FORM_URL`(시크릿 아님 - 비어 있으면 `/contact` 가입 CTA 미노출).
- Q&A 4종은 fail closed다. 하나라도 없으면 질문 생성이 거부되고 `/api/ready`가 503을 낸다 - 2026-07-29 롤백의 원인. 실제 읽는 지점은 `api/ready.ts`·`api/questions/index.ts`·`questions/new.astro`이고, `lib/qna/security.ts`는 값을 인자로 받아 검증만 한다.

## 5. 운영

- 로컬: `npm run dev` (wrangler platformProxy로 로컬 D1/R2). 시드: `node scripts/seed-seminar-posts.mjs`. 계정: `node scripts/create-user.mjs <id> <pw> [--remote]`.
- 시크릿: 로컬 `.dev.vars`, 원격은 단건 `wrangler secret put` 또는 gitignore된 `.dev.vars.production`을 `wrangler secret bulk`로 일괄 투입(운영 경로).
- QA: `npm test`(vitest) · `npm run verify`(3폭 렌더) · `npm run verify:admin`(어드민 작성 플로) · `npm run test:qna:d1`(Q&A D1 제약) · `npm run a11y`(Lighthouse) - 전부 `ci.yml` 게이트이고, 기본 경로에 글 상세를 포함한다.
- 레거시 301: `public/_redirects` - `/ko/*`·`/en/*`·구 slug(`2025-laos` 등)·구 회차 허브 전부 영구 이전.
- 슬래시 정규화: SSR 페이지는 미들웨어가 301, 프리렌더 정적 페이지(`/people/` 등)는 Workers Static Assets `drop-trailing-slash`가 **307**로 처리(플랫폼 기본값 수용 — 2026-07-27 결정).

## 6. 보류 콘텐츠 (D1, 코드 수정 대상 아님)

저장소가 아니라 D1 `posts` 행에 있는 미완 항목. `/admin`에서 채우면 즉시 반영되고 배포는 필요 없다.

- **제1차 세미나 (`event_date = 2025-12-26`)** - 전성호 교수 발표 제목·내용 추후 추가 예정. 현재 `summary`는 김원준·전성호 두 발표자를 밝히지만, `body`의 `## Featured presentation` 절은 김원준 발표 하나만 담고 있다. 자료 확보 시 그 절에 전성호 발표를 같은 형식(`### 제목` + `**Presenter:**` + 본문)으로 추가한다.
