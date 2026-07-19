# 초문화네트워크 (Transcultural Network, TCN) — 소개 사이트

디지털·AI 시대의 **초문화(transcultural) 현상**을 연구하는 국제 학술단체 초문화네트워크(TCN)의 공식 소개 웹사이트입니다. 한국어(`/ko/`)와 영어(`/en/`)를 제공하며, 루트(`/`)에서는 접속 국가와 저장된 사용자 선택에 따라 언어를 결정합니다.

- **배포**: https://tcn-ezj.pages.dev (Cloudflare Pages)
- **성격**: 정적(static) 학술단체 소개 사이트 — DB 없음, 루트 언어 분기에만 Cloudflare Pages Function 사용

---

## 1. 콘텐츠 내용

### 단체 소개

| 항목 | 내용 |
| --- | --- |
| 한글명 | 초문화네트워크 |
| 영문명 | Transcultural Network |
| 약칭 | TCN |
| 정의 | 국가·민족·언어·문화의 경계를 넘어 새로운 제3의 문화를 창조하는 국제 학술 네트워크 |
| 사무국 | 대한민국 서울 |
| 창립 | 2025-12-12, 성균관대 명륜캠퍼스 퇴계인문관 (창립국 15개국) |
| 회장 | 김원준 (Dr. Wonjoon Kim) |
| 수석부회장 | 전성호 교수 |
| 제1회 세미나 | 2025-12-26, 라오스 루앙프라방 |
| 차기 세미나 | 2026-10-30, 한국 |

### 페이지 구조 (5개 상위 메뉴 IA)

각 페이지는 한국어(`/ko/`)와 영어(`/en/`) 두 버전으로 제공됩니다. `/`는 콘텐츠 페이지가 아니라 Cloudflare 엣지 언어 분기 경로입니다.

| 경로 | 페이지 | 내용 |
| --- | --- | --- |
| `/` | 언어 분기 | 저장된 언어 선택 우선, 미선택 시 한국 IP는 `/ko/`, 그 외는 `/en/`로 302 이동 |
| `/{lang}/` | 홈 | 히어로, 미션, 핵심 활동, 세미나 하이라이트, 가입 안내 |
| `/{lang}/about` | 학회 소개 | 정체성, 미션·비전, 연혁 타임라인 |
| `/{lang}/about/founding` | 창립총회 | 창립총회 초청장과 행사 개요 |
| `/{lang}/about/declaration` | 창립 선언문 | 창립 선언문 전문 |
| `/{lang}/people` | 구성원 | 임원진·이사·감사 카드 (실명 미확보 시 "추후 공개") |
| `/{lang}/seminars` | 세미나 | 예정/지난 세미나 목록과 차기 세미나 강조 |
| `/{lang}/seminars/[slug]` | 세미나 상세 | 일정·장소·참여국과 확정된 프로그램·자료 |
| `/{lang}/contact` | 연락처 | 사무국 연락처 |

`{lang}`은 `ko` 또는 `en`입니다. 사용자가 헤더에서 언어를 직접 고르면 `tcn_locale` 쿠키에 1년간 저장하며, 다음 루트 방문부터 국가보다 이 선택을 우선합니다.

기존 prefix 없는 한국어 경로(`/about`, `/seminars` 등)와 `/events` 경로는 Cloudflare Pages의 `public/_redirects`에서 대응하는 `/ko/` 또는 `/en/` 페이지로 301 이동합니다.

### 콘텐츠 원칙

- **출처 기반만 수록** — 창립 선언문·정관·확정 질문지 근거 자료만 사용.
- **추정·창작 금지** — 미확보 임원 실명, 세미나 프로그램, 이메일 등은 만들지 않고 폴백 처리("추후 공개", "Details to be announced").
- **동의 없는 사진 미노출** — 임원 사진은 동의 확인 전까지 텍스트/모노그램 카드로만 표시.
- 내부 상태 마커(`[필요]` 등)는 공개 화면에 렌더링하지 않음.

### 콘텐츠 데이터 위치

콘텐츠는 코드와 분리된 JSON 데이터로 관리하며, Astro Content Layer(`file` 로더 + Zod 스키마)로 타입 검증합니다.

```text
src/data/
├── members.json       # 임원·구성원
├── seminars.json      # 세미나 목록
├── history.json       # 연혁 타임라인
└── invitations.json   # 창립총회 초청장 (→ /{lang}/about/founding)
```

- 새 세미나 추가: `seminars.json`에 ko/en 항목을 같은 `slug`로 추가 → 언어별 상세 라우트 자동 생성.
- 창립총회 초청장 수정: `invitations.json`의 ko/en 쌍을 함께 갱신.
- 스키마 정의: `src/content.config.ts`.
- 페이지 콘텐츠: `src/i18n/content.ts`, 공통 UI 문자열: `src/i18n/ui.ts`.
- `npm run i18n`으로 라우트·번역 키·ko/en JSON 쌍과 영문 한글 혼입을 검사.

---

## 2. 개발 내용

### 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| 프레임워크 | [Astro](https://astro.build) 7 (정적 사이트 생성) |
| 스타일 | [Tailwind CSS](https://tailwindcss.com) 4 (`@tailwindcss/vite`) + 디자인 토큰 |
| 폰트 | Noto Serif KR (명조, 헤드라인·본문) · Pretendard (내비·메타데이터) |
| 언어 | TypeScript |
| i18n | Astro 내장 i18n (`/ko/`, `/en/`) + Cloudflare 국가/쿠키 기반 루트 분기 |
| 검증 | `astro check` + Playwright 스크린샷 하네스 |
| 배포 | Cloudflare Pages + Pages Functions |

### 디자인 테마

에디토리얼(editorial) 학술지 감성 — SaaS 랜딩페이지 아님. **50대 후반 이상 한국어 독자**를 위한 권위·신뢰·가독성 중심. 전체 스펙은 [`DESIGN.md`](./DESIGN.md) 참조.

- **타이포가 정체성** — Noto Serif KR 명조 헤드라인(weight 600) + 세리프 본문 18px/행간 1.75. 이미지 없이 글자만으로 성립.
- **폰트 전송 최적화** — Noto Serif KR 400/600과 Pretendard Variable 동적 서브셋만 셀프호스팅하고, 해시 자산은 장기 캐시.
- **단일 강조색** — 딥 인스티튜셔널 블루 `#0b3d6b` (링크·아이브로·활성 상태 전용). 나머지는 종이 위 잉크(near-black `#141414`).
- **웜 페이퍼 배경** — 순백 대신 파치먼트 톤(`#f7f5f0` / `#f2efe7`)으로 눈부심 완화.
- **가독성 하한** — 최소 14px, 보조 텍스트 명도 `#5a5a5a`(약 7:1 대비) 이상.
- **드롭섀도 없음** — 헤어라인(1px)과 여백만으로 위계 표현.
- **터치 타깃 ≥ 48px** — 안드로이드 기본 확대에서도 편한 조작.

### 디렉터리 구조

```text
tcn/
├── astro.config.mjs        # Astro 설정 (i18n, Tailwind, site URL)
├── functions/
│   └── index.js            # 루트 국가/사용자 선호 언어 분기 (Pages Function)
├── src/
│   ├── pages/
│   │   ├── index.astro     # 공통 홈 페이지 구현
│   │   ├── about/          # 공통 소개 · 창립총회 · 창립 선언문 구현
│   │   ├── people.astro    # 공통 구성원 페이지 구현
│   │   ├── seminars/       # 공통 세미나 목록 · [slug] 상세 구현
│   │   ├── contact.astro   # 공통 연락처 페이지 구현
│   │   ├── ko/             # 한국어 라우트 미러 (/ko/…)
│   │   ├── en/             # 영어 미러
│   │   └── sitemap.xml.ts
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── components/         # Header, Footer, Button, MemberCard, SectionTile, Stat …
│   ├── data/              # 콘텐츠 JSON (members, seminars, history, invitations)
│   ├── content.config.ts   # 컬렉션 Zod 스키마
│   ├── i18n/               # ui.ts, content.ts, utils.ts
│   └── styles/
│       └── global.css      # 디자인 토큰 + Tailwind
├── public/
│   ├── _headers            # 해시 자산·폰트 장기 캐시
│   ├── _redirects          # legacy URL → 언어 prefix URL 301 이전
│   ├── _routes.json        # Function 실행 범위를 루트(/)로 제한
│   └── …                   # 파비콘, OG 이미지, manifest, robots.txt
├── scripts/
│   ├── verify.mjs          # Playwright 화면 검증
│   ├── motion.mjs          # 스크롤 모션·실패 폴백 검증
│   ├── a11y.mjs            # Lighthouse 접근성 검증
│   ├── i18n.mjs            # 한·영 정합성 감사
│   └── locale.mjs          # 국가 분기·언어 선택 쿠키 우선순위 검증
├── DESIGN.md               # 디자인 시스템 스펙
├── CONTENT_ARCHITECTURE.md # 콘텐츠·컬렉션 설계
└── MEMBERSHIP_FLOW.md      # 가입 플로우 메모
```

### 개발 실행

```bash
npm ci               # lockfile 기준 의존성 설치
npm run dev          # 개발 서버 (0.0.0.0, 핫리로드)
npm run build        # dist/ 정적 빌드
npm run preview      # 빌드 결과 미리보기
npm run check        # astro check (타입·스키마 검증)
npm run audit:prod   # 운영 의존성 보안 감사 (개발 전용 도구 제외)
npm run i18n         # 한·영 라우트·번역·데이터 정합성 검사
npm run locale       # 국가별 루트 분기·언어 선택 쿠키 우선순위 검증
npm run verify       # Playwright 스크린샷 검증 (서버 필요, 375/768/1280)
npm run motion       # 스크롤 리빌·reduced-motion·JS 실패 폴백 검증 (서버 필요)
npm run a11y         # Lighthouse 접근성 점수 검증 (preview 서버 필요)
```

- `npm run preview`는 정적 산출물 확인용이며 Pages Function을 실행하지 않습니다. 국가/쿠키 분기까지 로컬에서 확인하려면 `npm run build` 후 `npx wrangler pages dev dist`를 실행합니다.
- `verify`, `motion`, `a11y`는 기본적으로 `http://localhost:4321`의 실행 중인 서버를 사용하며 `BASE_URL`로 변경할 수 있습니다.
- **Node**: v26 호환 확인됨 (Playwright 1.61+).
- 필수 환경 변수나 데이터베이스 연결은 없습니다. 선택적 가입 폼은 `.env.example`의 `PUBLIC_MEMBERSHIP_FORM_URL`을 참고하며 `.env`는 커밋에서 제외합니다.
