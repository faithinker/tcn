# 세미나 콘텐츠 플랫폼 개발 계획 — Codex 안

작성일: 2026-07-22  
대상 브랜치: `fix/comprehensive-bug-fixes`  
상태: T1~T10 구현·검증 완료, 외부 활성화 대기
비교 시안: `/ko/seminars/1-preview`, `/en/seminars/1-preview`

## 결론

공개 사이트의 Astro 정적 배포는 유지하고, `/admin`에 인증된 작성 앱만 추가한다. 1차 구현은 콘텐츠·계정·이미지를 Supabase(Postgres/Auth/Storage)에 두고, 공개 시 Cloudflare Pages Deploy Hook을 호출해 정적 페이지를 다시 만든다. Supabase 무료 플랜은 고객 검증과 소규모 초기 운영에는 충분하지만 장기 무중단 운영을 보장하는 무료 서버로 간주하지 않는다. 무료 운영을 계속해야 한다면 현재 배포 환경과 같은 Cloudflare의 D1·R2·Access 조합을 별도 대안으로 둔다.

편집기는 Tiptap 3을 1순위로 권장한다. TOAST UI Editor는 한글 UI와 Markdown/WYSIWYG 전환이 장점이지만 GitHub의 최신 릴리스가 `3.2.2`(2023-02-24)여서 새 편집 환경의 기반으로 선택하기에는 유지보수 위험이 크다. Tiptap은 현재도 문서와 확장 생태계가 갱신되고 있고, 이미지 업로드 UI·진행률·취소 처리를 제공하면서 저장 형식을 구조화된 JSON으로 통제할 수 있다.

핵심 원칙은 다음과 같다.

1. 세미나 자체와 세미나에 속한 글을 분리한다.
2. 미래/과거 여부는 날짜와 행사 상태에서 계산하고, 작성자에게 중복 선택시키지 않는다.
3. 글 종류는 단일 선택으로 받되 URL의 영구 식별자는 종류나 제목 변경에 흔들리지 않게 한다.
4. 주소만 입력받고 Google Maps 검색 URL은 시스템이 생성한다.
5. AI 번역은 저장할 때마다 자동 실행하지 않는다. 작성자가 요청할 때 번역 초안을 만들고 사람이 검수한 뒤 별도로 공개한다.
6. 작성자는 등록·수정할 수 있지만 `DELETE` 권한은 DB 정책에서 최고관리자에게만 준다.

## 2026-07-22 구현 결과

- Supabase 원격 프로젝트 `geikofmifftlwnxyheph`에 migration 4개를 적용했고 로컬/원격 버전이 일치한다.
- 기존 JSON importer를 실행해 세미나 2개, 언어별 세미나 4개, 과거 글 3개, 글 번역 6개, revision 3개, legacy alias 4개를 이관했다.
- `/admin/login`, `/admin/posts`, `/admin/posts/new`, `/admin/seminars`와 정적 호스팅용 글 수정·미리보기 hash route를 구현했다.
- 작성자는 모든 글을 공동 수정하고 즉시 공개할 수 있으며, 직접 DML 우회와 삭제는 DB에서 차단하고 owner만 삭제할 수 있다.
- Tiptap 구조화 본문, 모바일 작성, 이미지 WebP 재인코딩·EXIF 제거·최대 2400px 제한, PDF/DOC/DOCX 검증·업로드, alt/caption 저장을 구현했다.
- 공개 transaction, revision, legacy 301 alias, 배포 상태, Claude 번역 job, Discord/Telegram outbox와 재시도를 구현했다.
- 홈·세미나 목록·회차 허브·글 상세·연혁·sitemap이 같은 공개 콘텐츠 snapshot을 사용한다.
- 관리자와 공개 렌더러는 `src/lib/content/schema.ts`의 동일한 콘텐츠 validator를 사용하며, 관리자 모듈에는 Tiptap용 타입 별칭만 남겼다.
- 전체 unit/integration 테스트 139개와 원격 pgTAP 52개가 통과했다. 공개/관리자 9개 경로의 375·768·1280px 검증 27건은 모두 HTTP 200, overflow 없음, 콘솔 오류 없음이었고 Lighthouse 접근성은 전 경로 100점이었다.
- 실제 계정을 만들지 않는 브라우저 전용 Supabase mock E2E에서 모바일 글 작성, 사진 변환·첨부, 지도 링크 생성, 초안 생성, 즉시 공개, 375·768·1280px 편집기 레이아웃을 검증했다.

아직 실행하지 않은 항목은 코드 미완성이 아니라 외부 활성화 단계다. 별도 승인 후 Supabase Edge Functions 2개를 배포하고 필요한 secret을 등록한 다음, owner/author 실제 계정을 발급하고 실 webhook·Claude workflow·Cloudflare 배포를 canary 글로 확인한다. 커밋·푸시·PR·프로덕션 배포는 수행하지 않았다.

## AI Development Workflow Routing Policy 적용

- 제품 목표가 이미 구체적이므로 별도 장기 Spec Kit 초기화는 하지 않는다.
- 현재 시안은 콘텐츠·시각 작업이므로 TDD를 생략하고 빌드·타입·브라우저 검증을 수행한다.
- CMS 구현 단계부터는 인증, 권한, 상태 전이, URL 생성, 게시 작업이 모두 동작 변경이므로 TDD를 기본으로 한다.
- 구현 직전에는 이 문서를 기준으로 가벼운 엔지니어링 리뷰를 한 번 수행한다.
- 커밋·PR·배포는 별도 승인 없이는 수행하지 않는다.

## 구현 목표와 루프 엔지니어링

### 완료 목표

T1~T10을 하나의 수직 흐름으로 완성한다. 작성자가 모바일 또는 데스크톱에서 로그인해 영어 원문과 사진·첨부 파일을 작성하고 즉시 공개하면, Supabase의 단일 데이터 원천에서 회차 허브·글 상세·홈·목록·연혁이 갱신되어야 한다. 번역과 알림은 비동기로 실행되고, 실패해도 원문과 공개 상태를 손상시키지 않아야 한다.

커밋·푸시·PR·프로덕션 배포와 실제 운영 작성자 계정 생성은 별도 승인 전까지 수행하지 않는다. 로컬 코드, migration, 테스트, 임시 Supabase 검증과 브라우저 E2E까지를 이 구현 목표의 완료 경계로 둔다.

### 오케스트레이션 DAG

```text
Contract: content types + body schema
          │
          ├──── A. T1/T2 DB·RLS·importer ───────┐
          ├──── B. T3/T9 public routes·adapter ─┼─ Integration: T6 publish
          └──── C. T4/T5 authoring·media ───────┘          │
                                                          ├─ T7 translation
                                                          ├─ T8 notification
                                                          └─ T10 full QA
```

- Coordinator: 공통 계약, 병합 판단, 외부 비밀값 경계, T6~T8 통합, 최종 검증을 소유한다.
- Worker A: `supabase/`와 importer만 소유하고 migration·RLS 테스트를 RED→GREEN으로 구현한다.
- Worker B: 공개 content adapter·회차 라우트·legacy redirect와 해당 테스트를 소유한다.
- Worker C: `/admin` React island·Tiptap·업로드 UX와 해당 테스트를 소유한다.
- 같은 파일을 두 worker가 동시에 수정하지 않는다. 공통 계약 변경은 coordinator가 승인하고 한 번만 반영한다.

### 반복 루프

```text
계획 확인
  ↓
RED: 가장 작은 실패 테스트 작성·실패 원인 확인
  ↓
GREEN: 해당 테스트만 통과하는 최소 구현
  ↓
REFACTOR: 중복 제거 후 관련 테스트 재실행
  ↓
INTEGRATE: 경계 계약·migration·타입·빌드 확인
  ↓
VERIFY: unit → integration → build → 375/768/1280 E2E → a11y
  ↓
실패 시 같은 계층으로 되돌아가 새 RED 테스트로 재현
```

각 worker의 완료 보고는 구현 파일, RED/ GREEN 증거, 남은 위험을 포함한다. coordinator는 worker 보고만 신뢰하지 않고 diff와 테스트를 다시 실행한다. 최종 완료 판정은 전체 테스트, Astro check/build, Supabase policy 검증, 모바일·데스크톱 작성/공개 E2E, 접근성 검사가 모두 최신 실행에서 통과한 경우에만 내린다.

## 현재 구조에서 제1차 세미나가 연결된 곳

```text
src/data/seminars.json
  ├─ /ko/seminars
  │    └─ "지난 세미나" 목록 → /ko/seminars/2025-laos
  ├─ /en/seminars
  │    └─ Archive → /en/seminars/2025-laos
  ├─ /ko/ 및 /en/
  │    └─ past[0]을 "최신 세미나"로 표시
  │         └─ 현재 버튼은 상세가 아니라 /{lang}/seminars로 이동
  ├─ /{lang}/seminars/[slug]
  │    └─ getStaticPaths가 2025-laos 상세 페이지 생성
  └─ /sitemap.xml
       └─ 한국어 slug를 기준으로 ko/en 상세 URL 생성

src/data/history.json
  └─ /ko/about 및 /en/about 연혁에 제1차 세미나를 별도 중복 저장

운영/검증 참조
  ├─ scripts/verify.mjs       /ko/seminars/2025-laos 하드코딩
  ├─ scripts/a11y.mjs        /ko/seminars/2025-laos 하드코딩
  ├─ docs/superpowers/...    대표 접근성 경로로 기록
  └─ public/_redirects       /seminars/* → /ko/seminars/:splat
```

직접 상세 링크는 세미나 목록에 있고, 홈은 제1차 세미나 제목·요약을 노출하지만 상세로 바로 연결하지 않는다. 헤더와 푸터는 세미나 목록만 가리킨다. `history.json`과 `seminars.json`이 같은 행사를 두 번 보유하므로 수정 누락 위험이 이미 존재한다.

## 무엇을 재사용하고 무엇을 바꿀지

### 재사용

- `BaseLayout.astro`: canonical, hreflang, SEO, 공통 헤더·푸터
- `seminars.astro`: 예정/지난 행사 분류와 기본 목록 UI
- `seminar-detail.astro`: 공개 상세의 타이포그래피와 구조화 데이터 패턴
- `DESIGN.md`, `global.css`: 노년층 가독성, 서체, 색상, 간격 토큰
- Cloudflare Pages 배포 파이프라인과 정적 산출물
- `getLangFromUrl`, `localizePath`, `formatDate`: 언어 경로와 날짜 처리

### 교체

- `seminars.json` + `history.json` 중복 데이터 → 하나의 `seminars` 테이블에서 연혁과 목록을 파생
- 연도-지역 slug → 변경되지 않는 세미나 회차 번호
- 자유 입력 `mapUrl` → 주소에서 생성되는 지도 링크
- 한국어/영어 레코드 복제 → 공유 메타데이터 + 언어별 번역 레코드
- 파일 편집 중심 운영 → 최고관리자가 미리 등록한 소수 작성자의 웹 작성 흐름

## 권장 시스템 경계

```text
                       ┌──────────────────────────┐
                       │  /admin (React island)   │
                       │  Tiptap + structured form│
                       └────────────┬─────────────┘
                                    │ Supabase client + JWT
                                    ▼
┌──────────────┐        ┌──────────────────────────┐
│ Supabase Auth│───────▶│ Postgres + RLS           │
│ invite only  │        │ seminars/posts/locales   │
└──────────────┘        │ revisions/outbox         │
                        └───────┬─────────┬────────┘
                                │         │
                         image  │         │ publish event
                                ▼         ▼
                       ┌────────────┐  ┌──────────────────┐
                       │ Storage    │  │ Edge Function    │
                       │ originals  │  │ notify + deploy  │
                       └────────────┘  └───────┬──────────┘
                                               │
                      ┌────────────────────────┼────────────────────┐
                      ▼                        ▼                    ▼
              Cloudflare Deploy Hook   Discord webhook     Telegram Bot API
                      │
                      ▼
            Astro build fetches only published rows
                      │
                      ▼
              static /ko + /en public pages
```

공개 페이지는 DB에 직접 쓰지 않는다. 브라우저에 노출되는 Supabase 키는 RLS가 적용된 publishable key뿐이다. Supabase secret key와 게시 workflow 호출 토큰은 서버·GitHub Secrets·Supabase Edge Function secret에만 보관한다. 번역은 저장소에 이미 등록된 `ANTHROPIC_API_KEY`를 GitHub Actions 안에서만 사용하며 브라우저나 Supabase DB에 복사하지 않는다. Discord/Telegram/Cloudflare 비밀 값도 기존 GitHub Secrets를 재사용한다.

## 편집기 선택

| 후보 | 장점 | 단점 | 판단 |
|---|---|---|---|
| Tiptap 3 | MIT 코어, 확장형 JSON 문서, 프레임워크 독립, 이미지 업로드 UI와 진행률 지원 | UI와 업로드 엔드포인트는 직접 연결해야 함 | **권장** |
| BlockNote | React에서 빠르게 완성되는 블록형 UX, 파일 업로드 훅 내장 | Tiptap 위 추상화가 한 겹 더 생기고 Notion형 UI가 이 사이트의 단순 기사 작성보다 큼 | 2일 스파이크 후보 |
| TOAST UI Editor | 한글 UI, Markdown/WYSIWYG, plain JS, MIT | 최신 릴리스가 오래됐고 Markdown 중심 모델이 세미나 메타데이터·번역 상태를 표현하지 못함 | 신규 기반으로 비권장 |
| Lexical | 작고 빠른 코어, React 생태계 | 이미지·문서 스키마·툴바·변환을 더 많이 직접 만들어야 함 | 과도한 자체 구축 |
| Sanity Studio | 작성 UI·미디어·현지화·웹훅을 빨리 확보 | 삭제 권한만 최고관리자에게 주는 세밀한 사용자 역할이 상위 요금제 의존 | 권한 요구와 불일치 |

편집기 내부에는 다음 블록만 먼저 허용한다: 문단, 제목 2/3, 굵게, 기울임, 링크, 인용, 순서/비순서 목록, 일정, 성과 목록, 이미지, 사진 묶음, 캡션, 구분선, 첨부 자료. 일정·성과·사진 묶음·첨부 자료는 Tiptap custom node와 입력 폼으로 구현한다. 임의 색상, 임의 글꼴, HTML, iframe, 표는 1차에서 제외한다. 디자인 시스템을 비개발자가 깨뜨릴 수 없게 만드는 것이 목적이다.

### 에디터가 공개 페이지를 만드는 방식

`/ko/seminars/1-preview` 같은 페이지를 Tiptap이 HTML째 자유롭게 만드는 구조가 아니다. 작성 폼과 제한된 본문 블록을 공개 렌더러가 디자인 시스템 컴포넌트로 변환한다.

```text
구조화 폼
  ├─ 회차, 제목, 리드문, 날짜, 장소, 주소, 상태, 문서 종류
  └─ 대표 이미지
             +
Tiptap body_json
  ├─ 소제목, 문단, 인용문, 일정, 이미지+캡션
  └─ PDF/Word 첨부 자료
             ↓
검증된 content schema
             ↓
Astro SeminarRenderer
  ├─ 제목 폭·글자 크기·줄바꿈은 템플릿이 제어
  ├─ 대표 이미지는 지정된 최대 폭과 안쪽 여백 적용
  ├─ 모든 이미지는 저장된 width/height로 원본 비율 유지
  ├─ 본문 이미지는 모바일 1열, 데스크톱 읽기 폭/2열 중 선택
  └─ 첨부 파일은 파일명·형식·크기·다운로드 버튼으로 출력
```

작성자는 글꼴 크기, 픽셀 폭, CSS, 임의 줄바꿈을 지정하지 않는다. 이미지 노드도 URL이나 인라인 스타일 대신 `assetId`, `alt`, `caption`, `layout`만 저장한다. `layout`은 `reading | wide | pair`처럼 허용된 선택지만 제공하고, 실제 `max-width`, padding, `height: auto`, width/height, lazy loading은 렌더러가 강제한다. 1차 구현은 업로드 이미지를 최대 2400px WebP 한 장으로 정규화하며, 여러 크기의 `srcset`과 AVIF는 실제 이미지 사용량이 늘 때 추가한다. 따라서 현재 시안에서 수정한 제목 폭과 대표 이미지 여백도 모든 향후 글에 일관되게 적용할 수 있다.

현재 `/ko/seminars/1-preview`와 작성 UI의 정확한 대응은 다음과 같다.

| 공개 시안 영역 | 작성자가 입력하는 곳 | 저장 값 | 공개 렌더러 동작 |
|---|---|---|---|
| `제1회` 시리즈 표기 | 세미나 회차 | `seminars.sequence` | 언어별 시리즈 문구 자동 생성 |
| 제목 | 상단 제목 필드 | `post_localizations.title` | 글자 크기·최대 폭·반응형 줄바꿈 자동 적용 |
| 리드문 | 상단 요약 필드 | `excerpt` | 최대 읽기 폭과 본문 서체 자동 적용 |
| 일시·장소·상태 | 행사 정보 폼 | `starts_at`, `place_name`, `event_status` | 우측 행사 정보와 과거/예정 상태 자동 생성 |
| 대표 사진 | 대표 이미지 업로드 | `hero_asset_id` | 원본 비율, 최대 폭, padding, `srcset` 자동 적용 |
| 소개 본문·소제목 | 일반 Tiptap 블록 | `paragraph`, `heading` nodes | 지정된 본문 폭과 디자인 토큰으로 출력 |
| 강조 인용문 | 인용 블록 | `blockquote` node | 시안과 같은 인용 컴포넌트로 출력 |
| 하루의 흐름 | 일정 추가 블록 | custom `programme` node | 시간·제목·설명을 반응형 일정 목록으로 출력 |
| 사진 2장과 캡션 | 사진 묶음 블록 | custom `gallery` node | 모바일 1열, 데스크톱 2열, 비율 유지 |
| 이후 성과 3개 | 성과 목록 블록 | custom `outcomes` node | 번호와 구분선을 포함한 목록으로 출력 |
| 관련 자료 | 첨부 자료 블록 | custom `attachments` node + asset rows | PDF 보기, Word 다운로드, 파일 형식·크기 표시 |
| Google 지도 링크 | 주소 필드 | `address` | 주소를 인코딩해 지도 URL 자동 생성 |

즉 Tiptap 기본 툴바만 설치해서 완성되는 기능은 아니다. `programme`, `gallery`, `outcomes`, `attachments` custom node, 서버 validation, 이미지·파일 업로드, `SeminarRenderer`를 함께 구현해야 시안과 같은 결과가 나온다. 이 네 요소를 구현 범위에서 빼면 일반 본문은 작성할 수 있어도 현재 시안 전체를 재현할 수 없다.

## 콘텐츠 모델

```text
seminars 1 ─────── N posts 1 ─────── N post_localizations
    │                  │                         │
    │                  ├──── N post_revisions   └─ title/excerpt/body_json
    │                  ├──── N translation_jobs
    │                  └──── N post_assets
    │                              │
    └──── N seminar_localizations  N assets
```

### `seminars`

- `id uuid`
- `sequence integer unique not null`: 1, 2, 3… 영구 회차
- `starts_at timestamptz`, `ends_at timestamptz`, `timezone`
- `event_status`: `scheduled | completed | postponed | cancelled`
- `place_name`, `address`, `latitude`, `longitude`
- `legacy_slug`: `2025-laos`
- `created_by`, `updated_by`, timestamps

`past/upcoming`은 별도 저장하지 않는다. 기본값은 `starts_at`과 현재 시각으로 계산하고, 취소·연기만 `event_status`로 명시한다.

### `posts`

- `id uuid`, `seminar_id uuid nullable`
- `post_no integer`: 세미나 안에서 증가하는 번호
- `kind`: `announcement | invitation | report | activity | materials | news`
- `workflow_status`: `draft | published | archived`
- `source_locale`: `ko | en`, 기본값은 `en`
- `created_by`, `updated_by`, `published_at`
- `source_revision integer`

`kind`는 라디오보다 한 개만 선택되는 큰 선택 카드 또는 `<select>`가 적합하다. 체크박스는 중복 분류를 허용하므로 사용하지 않는다. 태그만 복수 체크박스로 받는다. 영어를 기본 원문으로 작성하고 한국어를 첫 번역 대상으로 제공한다.

### `post_localizations`

- 복합 키: `(post_id, locale)`
- `title`, `excerpt`, `body_json`
- `slug`
- `translation_status`: `source | missing | ai_draft | human_reviewed | stale`
- `translated_from_revision`, `translation_provider`, `translation_model`
- `reviewed_by`, `reviewed_at`

### `translation_jobs`

- `id uuid`, `post_id`, `source_revision`, `source_locale`, `target_locale`
- `status`: `queued | running | succeeded | failed | cancelled`
- `provider`: `anthropic`, `model`: 실제 GitHub Actions 실행 모델 기록
- `github_run_id`, `attempt_count`, `error_code`, timestamps
- 같은 `post_id + source_revision + target_locale`의 활성 작업은 하나만 허용

### `assets`

- 원본 파일 경로, MIME, byte size, width/height, checksum
- `kind`: `image | document`, 문서는 원래 파일명과 확장자 저장
- 작성자, 업로드 시각, 이미지 처리 상태
- alt/caption은 언어별 `post_asset_localizations`에 저장
- 업로드 즉시 EXIF 위치 정보 제거, 최대 2400px 제한, WebP 최적화본 생성. 다중 크기/AVIF 파생본은 2차 최적화 범위
- 1차 문서 허용 형식: PDF, DOC, DOCX. 확장자뿐 아니라 MIME과 파일 시그니처를 서버에서 확인
- 문서는 본문 임의 HTML로 열지 않고 자료 블록으로 출력한다. DOC/DOCX는 다운로드를 기본으로 하고 PDF만 새 탭 보기를 허용한다.

### `profiles`와 권한

- `owner`: 모든 글 등록·수정·공개·보관·삭제, 초기 고정 계정 발급
- `author`: 작성자와 관계없이 모든 글 등록·수정·즉시 공개, 글 종류 변경, 이미지·자료 업로드, 삭제 불가

모든 author가 공동 편집하므로 `created_by`는 소유권 제한이 아니라 감사 기록에 사용한다. 저장할 때마다 `updated_by`와 revision snapshot을 남겨 변경자를 확인하고 이전 버전을 복구할 수 있게 한다. `DELETE` 버튼을 숨기는 것만으로는 부족하다. Postgres RLS에서 `owner`만 `DELETE`가 가능하도록 하고 Storage 삭제 정책도 동일하게 둔다. 일반 운영에서는 owner도 즉시 영구 삭제하지 않고 30일 소프트 삭제 후 정리한다.

## URL 정책

### 공개 경로

```text
/{lang}/seminars                         세미나 전체 목록
/{lang}/seminars/{sequence}              해당 회차의 허브
/{lang}/seminars/{sequence}/{kind}/{postNo}-{slug}
```

예시:

- `/ko/seminars/1`
- `/ko/seminars/1/announcements/1-first-seminar`
- `/ko/seminars/1/reports/2-activity-report`
- `/en/seminars/1/reports/2-activity-report`

`sequence`, `postNo`가 영구 식별자다. 제목을 바꾸면 slug만 갱신하고 이전 URL은 301 별칭으로 남긴다. 모든 author가 공개 후에도 `kind`를 변경할 수 있다. 변경 전 전체 URL을 alias 테이블에 저장하고 새 URL로 자동 301하며 revision과 감사 로그에 변경자를 남긴다.

### 기존 경로 이전

```text
/ko/seminars/2025-laos  → 301 → /ko/seminars/1
/en/seminars/2025-laos  → 301 → /en/seminars/1
```

첫 배포에서는 기존 URL도 같은 콘텐츠를 렌더링하고 canonical만 새 경로로 둔다. 검색엔진과 외부 링크가 새 경로를 수집한 뒤 301로 전환한다.

## 작성 UI와 내비게이션

```text
로그인
  ↓
전체 글 목록 ──────────────┐
  │                         │
  ├─ 새 글                  ├─ 수정
  │   1. 글 종류 선택       │   최근 버전 불러오기
  │   2. 세미나 연결/생성   │   변경 내용 자동 저장
  │   3. 행사 정보 입력     │
  │   4. 본문·사진 작성     │
  │   5. 번역 초안(선택)    │
  │   6. 모바일/PC 미리보기 │
  │   7. 공개               │
  └─────────────────────────┘
```

### 화면 구성

1. `/admin/login`: 최고관리자가 발급한 계정과 비밀번호. Cloudflare Access 대안에서는 허용된 이메일의 일회용 PIN 화면으로 대체
2. `/admin/posts`: 내 초안/공개 글, 언어 상태, 마지막 수정, 필터
3. `/admin/posts/new`: 글 종류와 연결할 세미나를 먼저 선택
4. `/admin/posts/[id]/edit`: 구조화 필드와 Tiptap 본문
5. `/admin/posts/[id]/preview`: 실제 공개 템플릿의 모바일/데스크톱 미리보기
6. `/admin/seminars`: 회차, 날짜, 상태, 관련 글 관리
7. `/admin/users`: 초기 범위에서 제외. 인원 추가·탈퇴가 잦아질 때 초대, 비활성화, 권한 변경 기능으로 추가

자동 저장은 2초 debounce로 수행하고 `updated_at` 기반 낙관적 잠금을 건다. 다른 탭이나 사용자가 먼저 저장했다면 덮어쓰지 않고 충돌 내용을 보여준다.

## 행사 분류 입력 규칙

- “미래/과거” 라디오를 만들지 않는다. 날짜에서 계산한다.
- “예정/완료/연기/취소”는 행사 상태 선택으로 받는다.
- “안내 글/초대장/결과 보고/활동 기록/자료/소식”은 하나의 글 종류 선택으로 받는다.
- 국가, 주제, 연구 분야는 복수 태그로 받는다.
- 글을 공개하면 홈·세미나 목록·해당 회차 허브가 같은 DB 조회 결과로 갱신된다.

```text
seminar.starts_at + event_status
       ├─ scheduled + future → 홈의 "차기 세미나"
       ├─ completed/past     → 세미나 아카이브
       └─ postponed/cancelled→ 상태 배지와 별도 안내

published post.kind
       ├─ announcement/invitation → 예정 세미나의 관련 안내
       ├─ report/activity         → 홈의 최근 활동 + 지난 세미나 허브
       └─ materials               → 허브의 관련 자료
```

## 지도 링크

작성자는 장소명과 주소만 입력한다. 저장 전에 다음 URL을 미리 보여준다.

```ts
const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
```

이 방식은 API 키와 별도 비용 없이 작동한다. 정확한 건물 핀이 필요한 행사가 늘어날 때만 Google Places 자동완성 또는 위도/경도 선택을 2차로 추가한다. 사용자가 긴 Google Maps URL을 직접 복사하게 하지 않는다.

## 로그인과 계정 발급

초기에는 운영 인원이 고정되어 있으므로 사용자 초대·탈퇴 관리 UI를 만들지 않는다. 최고관리자가 서로 다른 소수의 작성자 계정을 직접 생성하고 역할을 지정한다. 공용 계정 하나를 함께 쓰지는 않으며, 계정마다 별도 자격 증명을 사용한다. 최고관리자 계정은 작성자 계정과 분리한다.

작성자 추가·탈퇴가 반복되는 시점에 2차로 이메일 초대, 본인 비밀번호 설정, 비밀번호 재설정, 계정 비활성화, 역할 변경, 세션 회수 기능을 도입한다. 데이터 모델은 처음부터 사용자 ID와 역할을 분리해 두어 이 전환 때 콘텐츠나 작성 이력을 이전하지 않도록 한다.

로그인 링크는 주 내비게이션에 노출하지 않는다. 푸터의 작은 “콘텐츠 관리” 링크 또는 `/admin` 직접 주소로 제공한다. 인증되지 않은 사용자가 `/admin`에 접근하면 로그인으로 이동한다.

## 번역 정책

OpenAI API는 사용하지 않는다. 저장소에 이미 연결된 `anthropics/claude-code-action`과 GitHub Secret `ANTHROPIC_API_KEY`를 번역 실행 환경으로 재사용한다. 권장 흐름은 “수동 복붙”과 “매 저장 자동 번역”의 중간인 비동기 번역 작업이다.

1. 작성 화면은 영어 원문을 기본으로 열고 저장한다. 필요한 경우에만 원문 언어를 한국어로 바꿀 수 있다.
2. `번역 초안 만들기`를 누르면 현재 원문 revision을 고정한 `translation_jobs.status = queued` 행을 만든다.
3. 새 `translate-content.yml` GitHub Actions workflow가 대기 작업을 가져와 `running`으로 선점한다. 수동 `workflow_dispatch`와 정기 polling을 모두 지원한다.
4. workflow는 기존 `ANTHROPIC_API_KEY`와 Claude Code Action을 사용해 제목·요약·본문 블록·이미지 캡션을 번역한다. 초기 모델은 기존 workflow와 동일한 `claude-haiku-4-5`이며 workflow 변수로 교체 가능하게 한다.
5. Claude 출력은 곧바로 공개하지 않는다. 저장소의 JSON Schema와 콘텐츠 블록 validator를 통과한 결과만 `post_localizations`에 `ai_draft`로 저장한다.
6. 사람이 관리자 화면에서 검수하면 `human_reviewed`로 바뀐다.
7. 실행 도중 원문 revision이 바뀌면 결과를 덮어쓰지 않고 작업을 `failed/stale_source`로 종료한다. 검수 후 원문이 바뀐 번역도 `stale`로 표시한다.

GitHub Actions는 요청/응답형 API가 아니므로 작성 화면에는 `대기 중 → 번역 중 → 검수 필요/실패` 상태를 표시하고 polling으로 갱신한다. 번역 실패는 원문이나 기존 번역을 변경하지 않으며 workflow 재실행 또는 관리자 화면의 `다시 시도`로 새 attempt를 만든다.

용어집은 저장소의 `academic-translation` 용어를 시작점으로 하고, 고유명사·직함·행사명은 번역하지 않을 목록으로 분리한다. Claude 입력에는 신뢰된 시스템 지침과 번역 대상 JSON을 분리하고, 콘텐츠 안의 명령문을 지시사항으로 따르지 않도록 명시한다.

## Discord·Telegram 알림

게시 요청과 외부 알림을 같은 HTTP 요청에서 직접 처리하지 않는다. DB 트랜잭션으로 `notification_outbox`를 만들고 별도 함수가 전송한다.

```text
글 공개 트랜잭션
  ├─ posts.status = published
  ├─ revision snapshot 저장
  └─ outbox(event_id, channels, payload) 저장
             ↓
        worker/edge function
          ├─ Discord 전송
          ├─ Telegram 전송
          ├─ 성공 channel별 기록
          └─ 실패 지수 백오프 재시도
```

`event_id + channel`에 unique key를 두어 재시도 중 중복 알림을 막는다. 메시지에는 작성자, 글 종류, 언어, 제목, 미리보기 URL, 변경 종류(신규/수정)를 포함한다.

## 상태 전이

```text
                 ┌──────── source changed ────────┐
                 │                                 ▼
missing ──AI──▶ ai_draft ──human review──▶ human_reviewed
                 ▲                                 │
                 └────────── stale ◀───────────────┘

draft ──publish──▶ published ──owner archive──▶ archived
  ▲                    │
  └──── author edit ───┘  (새 revision 생성, slug/kind 변경 시 이전 URL 301)

DELETE: owner only, 기본 UI에서는 30일 soft-delete
```

## 단계별 구현

### Phase 0 — 비교 시안과 구조 합의

- Codex 전용 `/ko|en/seminars/1-preview` 검토
- Claude 시안과 정보 밀도, 사진 비중, 모바일 읽기 흐름 비교
- 고객에게 상세 페이지 컨셉 승인 받기
- canonical 회차 URL과 글 종류 확정

### Phase 1 — 데이터 기반과 권한

- Supabase 프로젝트, 스키마, migration, seed 작성
- 기존 `seminars.json`/`history.json` importer 작성
- 고정된 소수 계정 발급, `owner`/`author` RLS 정책 테스트
- Storage 업로드 정책과 이미지 제한 구현
- 공개 데이터 fetch adapter를 만들되 기존 JSON fallback 유지

### Phase 2 — 작성 앱

- `/admin/login`, 글 목록, 새 글, 수정 화면
- 구조화된 세미나 필드 + Tiptap React island
- 이미지 업로드, 진행률, 취소, alt/caption 필수화
- 자동 저장, 충돌 감지, revision 이력
- 모바일 375px에서 툴바, 키보드, 사진 첨부 검증

### Phase 3 — 공개 렌더링과 URL 이전

- `/seminars/{sequence}` 허브와 글 상세 라우트
- 홈/목록/연혁을 단일 조회 모델로 교체
- 이전 slug alias 및 canonical 적용
- sitemap/JSON-LD/verify/a11y 경로 갱신
- 게시 시 Deploy Hook, 빌드 실패 시 이전 사이트 유지

### Phase 4 — 번역과 알림

- `translation_jobs`, Claude GitHub Actions workflow, 구조화 출력 검증, 용어집, 실행 로그
- 번역 검수 및 stale 표시
- notification outbox, Discord/Telegram adapter, 재시도
- 공개 완료와 알림 실패를 독립적으로 관찰할 관리자 상태 UI

### Later — 계정 수명주기 관리

- 이메일 초대와 작성자 본인 비밀번호 설정
- 비밀번호 재설정, 계정 비활성화, 역할 변경, 세션 회수
- 사용자 추가·탈퇴 감사 로그와 owner 전용 사용자 관리 화면

## 테스트 계획

```text
AUTH / POLICY
  ├─ [unit] owner/author 역할 파싱
  ├─ [integration] author INSERT/UPDATE 허용
  ├─ [integration] author가 다른 author의 글 UPDATE 허용
  ├─ [integration] author DELETE 거부
  ├─ [integration] owner DELETE 허용
  ├─ [E2E] 발급된 author 계정 로그인
  └─ [E2E] 비활성 계정 접근 거부 (계정 관리 도입 시)

AUTHORING
  ├─ [unit] 글 종류/날짜/주소 validation
  ├─ [unit] Google Maps URL encoding
  ├─ [unit] Tiptap JSON schema + HTML sanitize
  ├─ [integration] 이미지 업로드 실패/취소/재시도
  ├─ [integration] PDF/Word MIME·파일 시그니처·용량 검증
  ├─ [integration] stale revision 충돌 거부
  └─ [E2E] 모바일 작성 → 사진 첨부 → 공개

PUBLICATION
  ├─ [unit] upcoming/past/status 파생
  ├─ [unit] route + legacy redirect 생성
  ├─ [integration] 공개 행만 빌드에 노출
  ├─ [integration] author 저장 후 승인 없이 즉시 공개
  ├─ [integration] 공개 글 kind 변경 → 이전 URL 301
  ├─ [integration] Deploy Hook 실패 시 재시도
  └─ [E2E] 공개 → 목록/홈/허브/상세 동시 반영

TRANSLATION / NOTIFICATION
  ├─ [eval] 고유명사·직함·본문 블록 보존
  ├─ [unit] source revision 변경 시 stale
  ├─ [integration] AI 실패 시 원문 보존 + 재시도
  ├─ [integration] channel별 부분 실패
  └─ [unit] event_id idempotency로 중복 발송 방지
```

## 실패 모드

| 실패 | 예방/복구 | 사용자에게 보이는 상태 |
|---|---|---|
| 세션 만료 중 저장 | 401 감지, 로컬 임시본 유지, 재로그인 후 재시도 | “로그인이 만료됐습니다. 작성 내용은 이 기기에 보관했습니다.” |
| 두 탭에서 동시 수정 | `updated_at`/revision 낙관적 잠금 | 충돌 비교 화면, 무음 덮어쓰기 금지 |
| 모바일 업로드 중 네트워크 단절 | resumable 또는 재시도 가능한 업로드, progress 상태 | 실패 사진만 다시 올리기 |
| 잘못된 주소 | 생성된 지도 링크 미리보기 확인 | 공개 전 위치 확인 경고 |
| 번역 API 실패 | 원문과 기존 번역 불변, job 실패 기록 | 번역 상태 `실패`, 다시 시도 |
| 번역 후 원문 수정 | source revision 비교 | 번역 `검토 필요` 배지 |
| 알림 한 채널만 실패 | channel별 outbox 상태와 재시도 | 글 공개는 유지, 관리자에 알림 실패 표시 |
| Deploy Hook/빌드 실패 | 이전 정적 배포 유지, 재시도 | 관리자에 “DB 공개됨/사이트 반영 대기” 분리 표시 |
| 악성 HTML/스크립트 | 제한된 Tiptap schema + 서버 sanitize | 위험 노드 제거 및 validation 오류 |
| author가 삭제 API 직접 호출 | DB/Storage RLS에서 거부 | 403과 권한 안내 |

테스트·오류 처리 없이 조용히 실패할 수 있는 경로를 허용하지 않는다. 특히 자동 저장, 게시 빌드, 알림은 각각 별도 상태를 저장해야 한다.

## 성능

- 공개 사이트는 정적 HTML을 유지하므로 방문자 요청에 DB 지연이 없다.
- 목록 빌드는 세미나·글·번역·대표 이미지 데이터를 한 번의 join/view로 가져와 N+1을 피한다.
- 1차는 브라우저에서 privacy-safe WebP로 정규화하고 width/height, 원본 비율, lazy loading을 보장한다. 실제 미디어 사용량이 늘면 원본 보관과 다중 `srcset`/AVIF 파생본을 worker로 분리한다.
- Tiptap과 Supabase SDK는 `/admin`에서만 로드하고 공개 번들에는 포함하지 않는다.
- 게시마다 전체 사이트 빌드가 부담이 되면 세미나 수가 충분히 늘어난 시점에 Astro on-demand rendering 또는 부분 빌드를 재검토한다.

## 무료 클라우드 구축 가능성 및 비용 경계

2026-07-22 공식 요금표 기준으로 초기 운영은 무료 구축이 가능하다. 다만 무료 플랜은 검증·소규모 운영 단계로 보고 사용량과 중단 조건을 관리한다.

### 권장 1차 — Supabase Free + 기존 Cloudflare Pages

- DB: 프로젝트당 500MB
- Auth: 월간 활성 사용자 50,000명으로 현재 소수 작성자에는 충분
- 파일: 1GB
- egress: 5GB + cached egress 5GB
- 활성 무료 프로젝트 2개
- 주의: 1주 비활성 후 프로젝트가 일시정지될 수 있다.

텍스트와 JSON은 500MB에 오래 머물 가능성이 높지만 사진 원본과 PDF/Word가 1GB를 먼저 소진할 수 있다. 업로드 시 이미지 최적화, 파일당 상한, 전체 사용량 70/85/95% 경고를 둔다. 고객 검증 및 초기 운영에서는 이 구성이 구현량이 가장 적다. 실제 상시 운영에서 자동 일시정지를 허용할 수 없다면 Supabase Pro 전환 비용을 운영비로 잡는다.

### $0 장기 운영 대안 — Cloudflare D1 + R2 + Access

- D1 Free: 계정 전체 5GB, 하루 500만 row read, 10만 row write
- R2 Standard Free: 월 10GB-month, Class A 100만 건, Class B 1,000만 건, 직접 egress 무료
- Cloudflare Access Free: 50명까지, 허용 이메일에 일회용 PIN 발송 가능
- 현재 사이트가 이미 Cloudflare Pages이므로 Pages Functions에서 D1/R2 binding을 사용할 수 있다.

이 대안은 Supabase의 비활성 일시정지와 1GB 파일 한도를 피하지만 Postgres RLS와 완성된 Auth 대신 Pages Functions에서 owner/author 권한 검사를 직접 구현·시험해야 한다. 초기 몇 명이 이메일 PIN 로그인을 사용해도 된다면 현실적인 영구 무료 후보이다. 반드시 관리자가 지정한 아이디·비밀번호 로그인이 필요하면 Better Auth + D1 같은 별도 인증 구현이 추가되어 보안·테스트 범위가 커진다.

결정 규칙은 단순하게 둔다.

1. 빠른 CMS 검증과 비밀번호 기반 계정이 우선이면 Supabase Free로 시작한다.
2. 무료 상태의 장기 유지와 파일 용량이 우선이고 이메일 PIN이 가능하면 Cloudflare D1/R2/Access를 택한다.
3. 고객 승인 후 실제 운영 SLA가 필요하면 무료 조건에 시스템을 맞추지 말고 유료 운영비를 확정한다.

## 구현 병렬화

| 작업 | 모듈 | 선행 |
|---|---|---|
| A. DB/Auth/권한 | `supabase/`, `src/lib/auth/` 또는 `functions/` | 없음 |
| B. 작성 UI/편집기 | `src/pages/admin/`, `src/components/admin/` | DB 타입 계약 |
| C. 공개 라우트/렌더러 | `src/pages/*/seminars/`, `src/lib/content/` | DB 타입 계약 |
| D. 번역/알림 | `supabase/functions/`, `src/lib/jobs/` | A |
| E. 이전/검증 | `scripts/`, `public/_redirects`, tests | A + C |

- Lane 1: A → D
- Lane 2: B (A의 타입 계약 확정 후 시작)
- Lane 3: C → E
- B와 C는 공통 `body schema`를 공유하므로 스키마 파일은 A 직후 먼저 합친다.

## Implementation Tasks

- [x] **T1 (P1)** — content model — Supabase migration과 기존 JSON importer 작성
- [x] **T2 (P1)** — authorization — 고정된 소수 계정, author 공동 수정·즉시 공개, owner 전용 삭제 정책을 테스트 우선으로 구현
- [x] **T3 (P1)** — routes — 회차 기반 허브·글 상세·legacy redirect generator 구현
- [x] **T4 (P1)** — authoring — 모바일 대응 구조화 폼과 Tiptap 편집기 구현
- [x] **T5 (P1)** — media — 이미지와 PDF/Word 업로드, alt/caption, MIME·용량 제한, WebP 최적화본 처리 구현
- [x] **T6 (P1)** — publishing — 공개 트랜잭션, revision, Cloudflare Deploy Hook 상태 구현
- [x] **T7 (P2)** — translation — 기존 Claude GitHub Actions를 이용한 사용자 요청형 번역 초안과 검수/stale 흐름 구현
- [x] **T8 (P2)** — notification — Discord/Telegram outbox와 재시도 구현
- [x] **T9 (P2)** — migration — 홈·목록·연혁을 단일 데이터 원천으로 전환
- [x] **T10 (P2)** — QA — 375/768/1280px 작성·공개 E2E와 접근성 검증

## 운영 활성화 체크리스트

다음은 구현 이후 owner가 명시적으로 승인할 때 한 번만 수행한다.

1. Supabase Dashboard에서 공개 email sign-up을 비활성 상태로 확인한다. 현재 저장소의 `config.toml`도 `enable_signup = false`지만 원격 설정은 별도 확인 대상이다.
2. Supabase Edge Function secret에 `GITHUB_ACTIONS_TOKEN`을 넣는다. 저장소가 기본값 `faithinker/tcn`과 다르면 `GITHUB_REPOSITORY`도 지정한다. Cloudflare Deploy Hook을 직접 쓸 때는 대신 `CLOUDFLARE_DEPLOY_HOOK_URL`을 사용한다.
3. 실제 배포 도메인이 기본 허용 목록과 다르면 `ALLOWED_ORIGINS`에 쉼표로 구분해 추가한다.
4. `publish-post`, `validate-asset` Edge Functions를 배포한다. 두 함수 모두 JWT 검증을 유지한다.
5. GitHub Actions secrets의 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, `DISCORD_WEBHOOK`, `TELEGRAM_TOKEN`, `TELEGRAM_TO`를 확인한다.
6. 초기 owner와 author를 각자 별도 계정으로 발급하고 `profiles.role`, `profiles.is_active`를 확인한다. 이메일 초대·탈퇴 UI는 Later 범위다.
7. 내부 canary 글 하나로 저장 → 사진/PDF/Word 첨부 → 공개 → 정적 배포 → Claude 번역 → Discord/Telegram 수신을 확인한 뒤 일반 작성자에게 `/admin` 주소를 전달한다.

로컬 `.env.local`은 gitignore 대상이며 현재 코드·CLI 검증에 필요한 값을 담는다. 비밀 값 자체는 문서·로그·브라우저 번들에 기록하지 않는다.

## NOT in scope

- 익명 회원가입과 공개 커뮤니티 댓글: 인증된 작성자 운영 목표와 다름
- 글 영구 삭제를 author에게 제공: 명시된 권한 정책과 충돌
- 실시간 공동 편집: 초기 N명 비동기 작성에는 비용 대비 과함
- Google Places 유료 자동완성: 무료 지도 검색 URL로 먼저 검증
- Claude 번역 자동 공개: 학술 용어와 고유명사 오역 위험
- 네이티브 모바일 앱: 반응형 웹 작성 경험을 먼저 완성
- 이메일 초대·탈퇴·권한 변경 관리 UI: 운영 인원 변동이 잦아지는 시점까지 연기

## 확정된 제품 결정

1. 모든 author가 작성자와 관계없이 모든 글을 공동 수정한다.
2. author는 owner 승인 없이 글을 즉시 공개할 수 있다.
3. 영어를 기본 원문 언어로 우선 지원하고 한국어를 첫 번역 언어로 둔다.
4. 모든 author가 공개 후에도 글 종류를 변경할 수 있다. 기존 URL은 자동 301하고 변경 이력을 보존한다.

따라서 owner만의 독점 권한은 사용자 계정 관리와 글 삭제이며, 일반 콘텐츠 운영은 author가 독립적으로 완료할 수 있다.

## 공식 자료

- Tiptap 개요: https://tiptap.dev/docs/editor/getting-started/overview
- Tiptap 이미지: https://tiptap.dev/docs/editor/extensions/nodes/image
- Tiptap 이미지 업로드 UI: https://tiptap.dev/docs/ui-components/node-components/image-upload-node
- TOAST UI Editor: https://github.com/nhn/tui.editor
- BlockNote: https://www.blocknotejs.org/docs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase 요금과 무료 한도: https://supabase.com/pricing
- Cloudflare D1 요금: https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare R2 요금: https://developers.cloudflare.com/r2/pricing/
- Cloudflare Access 요금: https://www.cloudflare.com/plans/zero-trust-services/
- Cloudflare Access 이메일 OTP: https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/
- Cloudflare Pages D1/R2 binding: https://developers.cloudflare.com/pages/functions/bindings/
- Cloudflare Pages Deploy Hooks: https://developers.cloudflare.com/pages/configuration/deploy-hooks/
- Anthropic Claude Code Action: https://github.com/anthropics/claude-code-action
- Sanity localization: https://www.sanity.io/docs/studio/localization
- Sanity roles: https://www.sanity.io/docs/user-guides/roles
