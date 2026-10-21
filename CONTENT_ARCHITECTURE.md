# TCN Content Architecture

Updated: 2026-10-21 (통합 회원 기능과 계정 수명주기의 브랜치 구현 반영. 운영 활성화는 별도 승인)

Runtime: Astro 7 hybrid on **Cloudflare Workers** (`@astrojs/cloudflare`) - 정적 프리렌더 + 동적 SSR. TypeScript 6(`astro check`가 TS 7을 아직 지원하지 않아 6 계열 유지), 빌드·CI의 Node 버전은 `.nvmrc`가 기준. 배포는 `wrangler deploy` (`.github/workflows/deploy-workers.yml`). 버전의 단일 원천은 `package.json`.

## 1. 원칙

- **콘텐츠 단일 원천 = D1** (`tcn-content`): 세미나·활동 글 전부 `posts` 테이블. 회차 개념 없음 - 미래 `event_date` 글이 곧 "차기 세미나".
- **글 저장 = 상세 페이지 즉시 공개·즉시 삭제**: `/seminars/[date]`는 D1을 SSR로 조회한다. 홈·`/about`·`/seminars`는 Worker 요청 한도(Free 10만/일)를 아끼려고 빌드 직전 D1 스냅샷으로 구운 정적 페이지이며, 변경은 최대 15분쯤 뒤 반영된다 - `refresh-static-content` 워크플로가 10분마다 지문을 비교해 재배포한다([`docs/deployment.md`](./docs/deployment.md#정적-공개-페이지와-자동-갱신)).
- **영어 단일 사이트**: `/ko`·`/en` 프리픽스 없음. 구 URL은 `public/_redirects` 정적 301 표가 전담.
- **대표 주소 = `https://thetcn.org`** (커스텀 도메인): `astro.config.mjs`의 `site`가 canonical·`og:url`·`sitemap.xml`의 기준이다. `public/robots.txt`의 `Sitemap:` 줄은 정적 파일이라 `site`에서 파생되지 않으므로 따로 맞춘다. `tcn.faithinker12.workers.dev`는 같은 Worker의 기본 주소로, 배포 smoke(`deploy-workers.yml`)가 아직 이 주소를 친다. 도메인 변경 시 맞출 곳은 [`docs/deployment.md`](./docs/deployment.md#도메인).
- 공개 콘텐츠는 확정 사실만. 미정 정보는 명시적 폴백(`To be announced`).

## 2. 라우트

| 경로                                                       | 렌더           | 소스                                                                                                   |
| ---------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| `/`                                                        | 정적(스냅샷)   | D1 스냅샷 (차기/최신 글) + `i18n/content.ts` 카피                                                      |
| `/about`                                                   | 정적(스냅샷)   | `content.ts`, `data/organization-milestones.ts` + D1 스냅샷 세미나 병합 연혁                           |
| `/about/{founding,declaration,bylaws}`                     | 정적           | `content.ts`, `invitations.json`                                                                       |
| `/people`                                                  | 정적           | `members.json`                                                                                         |
| `/seminars`                                                | 정적(스냅샷)   | D1 `posts` 스냅샷 (예정/지난 = `event_date` 파생)                                                      |
| `/seminars/[date]`                                         | SSR            | D1 `posts`+`media` (마크다운→HTML, `lib/posts`). 구 `/seminars/p/[id]`는 여기로 301                    |
| `/contact`                                                 | 정적           | `content.ts` (+`PUBLIC_MEMBERSHIP_FORM_URL` 설정 시 가입 CTA)                                          |
| `/questions`                                               | SSR            | D1 `qna_questions`+`qna_answers` 공개 목록 (`Cache-Control: no-store`)                                 |
| `/questions/new`                                           | SSR (noindex)  | 질문 작성 폼 (`TURNSTILE_SITE_KEY` 위젯)                                                               |
| `/questions/[id]`                                          | SSR            | D1 질문 상세 + 공식 답변. noindex는 not-found·조회실패일 때만                                          |
| `/login`, `/signup`                                        | SSR (noindex)  | 회원 로그인(복귀 경로를 현재 권한으로 재검증)과 이메일 인증 가입. 가입은 `SIGNUP_ENABLED` 꺼짐이면 404 |
| `/forgot-password`, `/reset-password`                      | SSR (noindex)  | 비밀번호 재설정. 메일함 존재 여부를 숨기고 링크는 1회용·30분                                           |
| `/account`, `/account/withdrawn`                           | SSR (noindex)  | 내 상태·프로필·비밀번호 변경·전체 기기 로그아웃·탈퇴, 탈퇴 완료 안내                                   |
| `/forum/{assembly,directors}`, `/forum/[board]/{new,[id]}` | SSR (noindex)  | D1 `forum_posts` 목록·작성·상세. 게시판별 최소 등급은 `FORUM_MIN_TIER`                                 |
| `/404`                                                     | 정적 (noindex) | 하드코딩 카피                                                                                          |
| `/sitemap.xml`                                             | SSR            | 정적 경로(`/questions` 포함) + D1 글                                                                   |
| `/admin`, `/admin/**`                                      | SSR (noindex)  | 작성 앱 (React island + Tiptap→마크다운)                                                               |
| `/admin/questions`, `/admin/questions/[id]`                | SSR (noindex)  | Q&A 콘솔 - 대기/답변/숨김 탭, 답변 작성·공개 여부 전환                                                 |
| `/admin/users`                                             | SSR (noindex)  | 결정권자 전용 사용자 관리 - 승인·반려·복구, 권한 변경                                                  |
| `/api/{auth,posts,media}/**`                               | SSR            | 인증(가입·재설정 포함)·CRUD·업로드                                                                     |
| `/api/account/{profile,password,withdraw}`                 | SSR            | 본인 계정 변경 (세션+동일출처+`account` 범위 CSRF)                                                     |
| `/api/forum/[board]`, `/api/forum/[board]/[id]`            | SSR            | POST 글 작성 / PUT 본인 수정 / DELETE 숨김 (본인 또는 결정권자)                                        |
| `/api/users/[id]/{status,permissions}`                     | SSR            | PATCH 상태·권한 변경 (결정권자 전용, `revision` 낙관적 락, 감사 기록 동반)                             |
| `/api/questions`                                           | SSR            | POST 질문 생성 (Turnstile 검증 + 레이트리밋). 공개 조회는 페이지가 직접 D1                             |
| `/api/questions/[id]/answer`                               | SSR            | PUT 공식 답변 upsert (세션+동일출처+CSRF, `expectedRevision` 낙관적 락)                                |
| `/api/questions/[id]/visibility`                           | SSR            | PATCH 공개/숨김 전환 (같은 가드)                                                                       |
| `/api/health`, `/api/ready`                                | SSR            | liveness / 바인딩·시크릿 readiness (하나라도 없으면 503)                                               |
| `/api/maintenance/media-cleanup`                           | SSR            | POST 고아 R2 키 정리 - 인증 필요, 멱등 (`media_cleanup_queue`)                                         |
| `/media/[...key]`                                          | SSR            | R2 스트리밍                                                                                            |

회원 경로(`/login`부터 `/admin/users`와 관련 API까지)는 `MEMBER_FEATURES_ENABLED`가 정확히 `true`일 때만 열리고, 꺼져 있으면 503이다(`/signup`과 가입 API는 `SIGNUP_ENABLED`가 꺼져 있으면 404). 보호 경로는 no-store/noindex이고 sitemap에 넣지 않는다.

## 3. 데이터

- **D1 17테이블** (`migrations/*.sql` 11개, `0001_init.sql` 이후는 additive만):
  - 콘텐츠: `users`(수동 발급, PBKDF2, `session_version`으로 일괄 세션 무효화) · `posts`(title/summary/event_date/address/body-markdown/hero, soft delete, `revision` 낙관적 락) · `media`(R2 키+메타, image/video/document)
  - 운영: `media_cleanup_queue`(고아 R2 키 큐) · `auth_rate_limits`(로그인 시도 제한)
  - 공개 Q&A: `qna_questions` · `qna_answers` · `qna_audit_events`(답변·공개여부 변경 감사) · `qna_rate_limits` · `qna_turnstile_tokens`(토큰 재사용 차단)
  - 회원: `forum_posts`(board·작성자·revision·숨김), `user_audit_events`(상태·권한 전후 값과 수행자·requestId). `users`에는 role/status/is_executive/can_access_directors_forum/affiliation과 변경 revision을 둔다.
  - 계정 수명주기(`0011`): `auth_email_challenges`(가입·재설정 인증 코드, purpose로 구분) · `auth_mail_limits`(메일 발송 제한) · `account_events`(탈퇴 기록, requestId 멱등) · `account_reauth_failures`(재인증 실패 횟수) · `auth_local_mail`(로컬·loopback 전용 합성 메일함). `users`에는 `email_verified_at`·`deleted_at`이 추가된다.
- **R2** (`tcn-media`): 원본 파일. 이미지는 업로드 시 브라우저에서 WebP(≤2400px)+EXIF 제거, 서버 재검증.
- **정적 데이터**: `src/data/organization-milestones.ts`(연혁 확정 기록), `members.json`, `invitations.json`, `founding-media.json` (Astro 컬렉션은 members·invitations만)
- **카피**: `src/i18n/content.ts`(페이지 본문 카피) + `ui.ts`(UI 문자열 사전 + `t()`). `i18n/utils.ts`는 `formatDate`만 - 영어 단일이라 언어 분기 없음.

## 4. 권한·알림

- 인증: 서명 세션 쿠키(HMAC, 1일). 수동 발급과 플래그로 닫힌 사이트 내 가입을 지원한다. 신규 가입 기본값은 member/pending이며 승인 후에도 운영 권한은 자동 부여하지 않는다.
- 승인된 officer만 세미나·미디어·공식 답변을 관리한다. 감사·고문은 approved member + 임원 게시판 특별 접근만 가진다. 결정권자는 사용자 관리·타인 Forum 글 숨김이 가능하나 자기 자신·기존 결정권자의 상태/권한은 변경하지 못한다.
- Q&A 변경은 공용 `requireMutation`을 officer/qna 범위로 호출한다. Forum은 activeAccount/forum 후 게시판·작성자 검사, 사용자 관리는 executive/users 후 대상 보호 검사로 처리한다. 상태·권한 변경과 감사 기록은 하나의 D1 배치이며 revision 충돌은 409다. Forum 변경은 알림을 보내지 않는다.
- `MEMBER_FEATURES_ENABLED`는 초기 명단 검증까지 Forum·사용자 관리를 닫고, `SIGNUP_ENABLED`는 공개 가입을 별도 통제한다. 정확히 true일 때만 열린다.
- 알림: 글 등록/수정 → `waitUntil`로 Discord webhook + Telegram sendMessage (`lib/notify`). 베스트에포트 - 실패해도 글 무영향. 시크릿: `DISCORD_WEBHOOK`, `TELEGRAM_TOKEN`, `TELEGRAM_TO`.
- **Q&A 질문 제출은 알림을 보내지 않는다** - 의도된 설계다. `lib/notify`는 `api/posts`에서만 호출된다. 운영자는 어드민 내비의 대기 질문 건수 배지로만 새 질문을 인지한다.
- 설정 인벤토리(`.env.example`): 위 알림 시크릿 + `SESSION_SECRET` + Q&A 4종 `TURNSTILE_SITE_KEY`·`TURNSTILE_SECRET_KEY`·`QNA_TURNSTILE_HOSTNAMES`·`QNA_RATE_LIMIT_SECRET` + `PUBLIC_MEMBERSHIP_FORM_URL`(시크릿 아님 - 비어 있으면 `/contact` 가입 CTA 미노출).
- Q&A 4종은 fail closed다. 하나라도 없으면 질문 생성이 거부되고 `/api/ready`가 503을 낸다 - 2026-07-29 롤백의 원인. 실제 읽는 지점은 `api/ready.ts`·`api/questions/index.ts`·`questions/new.astro`이고, `lib/qna/security.ts`는 값을 인자로 받아 검증만 한다.

## 5. 운영

회원 검증은 `test:forum:d1`, `test:users:d1`, `verify:forum-users`, 계정 수명주기는 `test:account:d1`, `verify:account`로 추가한다. 실제 workerd D1과 역할별 로컬 브라우저 하네스를 사용하며, 운영 계정 반영과 배포는 통합 구현·검증 후 승인된 절차에서 수행한다. 운영 스크립트의 actor·bootstrap·감사 기록은 [운영 런북](./docs/operations-runbook.md#account-roles-and-executive-authority)을 따른다.

- 로컬: `npm run dev` (wrangler platformProxy로 로컬 D1/R2). 시드: `node scripts/seed-seminar-posts.mjs`. 계정: `node scripts/create-user.mjs <id> --role officer|member [--remote]`(비밀번호는 숨김 프롬프트 또는 `TCN_USER_PASSWORD`).
- 시크릿: 로컬 `.dev.vars`, 원격은 단건 `wrangler secret put` 또는 gitignore된 `.dev.vars.production`을 `wrangler secret bulk`로 일괄 투입(운영 경로).
- QA: `npm test`(vitest) · `npm run verify`(3폭 렌더) · `npm run verify:admin`(어드민 작성 플로) · `npm run verify:founding-media`(창립 미디어 갤러리) · `npm run verify:seminar-carousel`(세미나 캐러셀) · `npm run test:qna:d1`(Q&A D1 제약) · `npm run test:roles:d1`(역할 D1 제약) · `npm run a11y`(Lighthouse) - 전부 `ci.yml` 게이트이고, 기본 경로에 글 상세를 포함한다. `npm run motion`은 게이트가 아닌 로컬 확인용. 실행법은 [`docs/development.md`](./docs/development.md#로컬-실행).
- 레거시 301: `public/_redirects` - `/ko/*`·`/en/*`·구 slug(`2025-laos` 등)·구 회차 허브 전부 영구 이전.
- 슬래시 정규화: SSR 페이지는 미들웨어가 301, 프리렌더 정적 페이지(`/people/` 등)는 Workers Static Assets `drop-trailing-slash`가 **307**로 처리(플랫폼 기본값 수용 — 2026-07-27 결정).

## 6. 보류 콘텐츠 (D1, 코드 수정 대상 아님)

저장소가 아니라 D1 `posts` 행에 있는 미완 항목. `/admin`에서 채우면 즉시 반영되고 배포는 필요 없다.

- **제1차 세미나 (`event_date = 2025-12-26`)** - 전성호 교수 발표 제목·내용 추후 추가 예정. 현재 `summary`는 김원준·전성호 두 발표자를 밝히지만, `body`의 `## Featured presentation` 절은 김원준 발표 하나만 담고 있다. 자료 확보 시 그 절에 전성호 발표를 같은 형식(`### 제목` + `**Presenter:**` + 본문)으로 추가한다.
