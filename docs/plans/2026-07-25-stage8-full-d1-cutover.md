# 8단계 — 공개 전면 D1 전환 · 단일 언어 · Workers 배포

작성: 2026-07-25 (Claude)
전제: 7.5단계까지 완료 — admin CMS(D1+R2) 가동, 공개 최소 연결(`/seminars/p/[id]` + 목록 섹션) 완료, 커밋 `7e4a010`.

## 결승선 (Definition of Done)

1. 공개 사이트의 모든 동적 콘텐츠가 **D1 하나**에서 나온다 — Supabase 코드·의존성·시크릿·환경변수 0건
2. 글 저장 = **즉시 공개** (재빌드 없음, deploy hook 개념 소멸 — 슬림 설계의 핵심 이득)
3. Cloudflare **Workers 단일 배포** (`wrangler deploy`), 운영 계정 N개 발급, 알림 훅 재부착
4. 구 URL 전부 301 보전, 전체 테스트·verify·a11y 그린

## 결정 (2026-07-25 확정)

- **D-1 세미나 회차 표현**: ✅ **(a) D1 posts로 통합** — event_date 미래 글 = 홈 '차기 세미나' 히어로. 비개발자가 admin에서 직접 수정. 세미나 전용 코드 소멸
- **D-2 언어 정책**: ✅ **(a) 영어 단일 확정** (재확인 완료) — `/en`·`/ko` 프리픽스 제거 → 루트 단일 트리, 영문 카피 채택, SEO 전면 301 감수

## 현재 결합 실측 (2026-07-25 23:30)

- `src/lib/content`(구 스택) 소비: **18파일** — astro.config(redirects 훅), 홈·목록·about 템플릿, sequence/kind/alias 라우트 8개, 구 렌더러 4개(seminar-detail, post-detail, content-body/inline), sitemap
- `.github/workflows/deploy-pages.yml`: Supabase env 주입 + 삭제된 `record-deployment.mjs` 호출 → 교체 대상
- `wrangler.jsonc`: Workers 배포 준비 완료 (D1·R2·ASSETS 바인딩, nodejs_compat)
- `functions/index.js`: Pages 전용 루트 언어 리다이렉트 — Workers 전환 시 폐기 대상
- `@supabase/supabase-js` 의존성 잔존

## 작업 분해

### T1 — 콘텐츠 이행 (D-1 확정 후)
- 세미나 2건 → D1 posts 2행 (2차: event_date 2026-10-30·주소·요약 / 1차: 과거 글). admin에서 직접 입력하거나 1회성 스크립트
- about 연혁: 창립(정적 확정 콘텐츠) + 세미나 항목은 posts에서 파생 or 정적 유지 — 연혁은 정관 기반 확정 기록이므로 **정적 데이터로 단순화** 권장, 세미나 항목만 글 링크
- `seminars.json`·`history.json` 은퇴 준비

### T2 — 공개 라우트 재편 (D1 읽기)
- 삭제: `[sequence].astro`, `[sequence]/[kind]/[post].astro`, `[kind]/[sequence].astro`, `[...alias].astro` (ko/en 8파일) + 구 렌더러 4파일
- `/seminars` 목록(SSR): 예정/지난 글 구분 = event_date 파생 (이미 확정된 UX 규칙 — 라디오 없음)
- 홈(SSR 전환): '차기 세미나' 히어로 = 미래 event_date 최신 글, '최근 활동' = 최신 글. `selectors` 대체는 SQL 2줄
- 상세 `/seminars/p/[id]`: 유지 + **Event JSON-LD 조건부 추가**(event_date 있으면) — 기존 리치 스니펫 보전
- sitemap: D1 조회 SSR 엔드포인트로 전환
- 캐시(선택): 공개 SSR에 `Cache-Control: s-maxage=60` — Workers 부하·지연 완화

### T3 — 단일 언어 재구조 (D-2가 (a)/(b)일 때)
- `pages/{ko,en}/**` → `pages/**` 단일 트리, page-templates lang 분기 제거
- `i18n/content.ts` → 단일 카피 모듈로 축소, `getLangFromUrl`/`localizePath`/스위처/hreflang 제거
- astro i18n 설정·`src/middleware.ts` 정리, `functions/` 삭제
- `_redirects` 전면 재작성: `/ko/* → /:splat 301`, `/en/* → /:splat 301`, 레거시(`2025-laos`, `/events/*`, `/seminars/1·2`) → 새 글 URL 301
- ⚠️ SEO: 전 URL 301 + hreflang 소실 — 재색인 기간 수 주. 감수 여부가 D-2 결정에 포함됨

### T4 — 구 스택 제거
- `src/lib/content/` 전체 삭제 (adapter·routes·schema·selectors·article-layout·types·redirects + 테스트)
- astro.config `contentAliasRedirects` 훅 제거 — alias 개념 소멸, `_redirects`는 T3 표로 수동 관리
- `content.config.ts`: members·invitations만 유지
- deps: `@supabase/supabase-js` 제거, `.env.example` Supabase 블록 제거, `.env.local` 정리 안내

### T5 — 배포 파이프라인 교체
- `deploy-pages.yml` → `deploy-workers.yml`: `wrangler-action`으로 `wrangler deploy`. 기존 `CLOUDFLARE_API_TOKEN`/`ACCOUNT_ID` 시크릿 재사용, Supabase env 전부 제거
- `_headers`/`_routes.json` Workers assets 의미 검토(불필요 시 제거)
- 롤백: 기존 Pages 프로젝트(정적)는 전환 검증 완료까지 유지

### T6 — 원격 활성화
- `wrangler secret put SESSION_SECRET`
- 운영 계정: `node scripts/create-user.mjs <id> <pw> --remote` × N (사용자가 id/pw 지정 — 기존 요구사항)
- 커스텀 도메인/라우트 연결, 프로덕션 로그인→작성→공개 E2E

### T7 — 알림 재부착 (소형)
- outbox 없이 단순화: `POST/PUT /api/posts` 성공 후 `ctx.waitUntil`로 Discord webhook + Telegram sendMessage (재시도 2회, 실패는 로그만 — 알림은 결제가 아님)
- 시크릿: `wrangler secret put DISCORD_WEBHOOK / TELEGRAM_TOKEN / TELEGRAM_TO` (값은 GH 시크릿에 이미 존재)
- 신규/수정 구분 메시지, 수정 스팸은 갱신 시각 디바운스

### T8 — QA·스크립트 정리
- `verify.mjs`/`a11y.mjs` ROUTES 단일 트리로 갱신, `i18n.mjs`/`locale.mjs` 스크립트 은퇴 여부 결정
- 전체: vitest + build + verify(3폭) + a11y + admin E2E + 프로덕션 스모크

### T9 — 문서·PR
- `CONTENT_ARCHITECTURE.md` 재작성(D1 3테이블 기준), CHANGELOG 기록(pr-changelog 스킬), PR 생성 — 푸시·머지는 승인 후

## 순서

```text
D-1·D-2 확정
  → T1(이행) → T2(라우트) ⇄ T3(단일언어, 동시 진행) → T4(제거)
  → T5(배포) → T6(활성화) → T7(알림) → T8(QA) → T9(PR)
```

T5 준비(워크플로 작성)는 T1~T4와 병렬 가능. 예상 규모: 집중 1.5~2일.

## 리스크·완화

| 리스크 | 완화 |
|---|---|
| SEO 전면 301 (T3) | 301 영구 유지 + sitemap 즉시 갱신 + Event JSON-LD 보전. 감수 결정 명시 |
| SSR 전환 후 D1 장애 시 공개 페이지 다운 | 목록·홈에 try/catch 폴백(빈 섹션) 이미 패턴화, s-maxage 캐시 |
| Workers 전환 중 배포 공백 | 기존 Pages 정적 배포 유지한 채 Workers 병행 검증 후 도메인 전환 |
| 구 URL 깨짐 | `_redirects` 표를 T3에서 전수 작성, verify에 301 체크 추가 |
