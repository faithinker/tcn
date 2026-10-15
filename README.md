# 초문화네트워크 (Transcultural Network, TCN) - 사이트 + 콘텐츠 플랫폼

디지털·AI 시대의 **초문화(transcultural) 현상**을 연구하는 국제 학술단체 초문화네트워크(TCN)의 공식 웹사이트입니다. 소개 사이트에 더해, 지정된 회원이 로그인해 세미나·활동 글을 직접 작성·공개하는 콘텐츠 플랫폼을 포함합니다.

- **운영 주소**: [https://thetcn.org](https://thetcn.org) - 커스텀 도메인. canonical·sitemap의 기준 주소입니다.
- **기본 주소**: [https://tcn.faithinker12.workers.dev](https://tcn.faithinker12.workers.dev) - 같은 Cloudflare **Workers** 배포의 `workers.dev` 주소.
- **이전 배포 (구버전)**: [https://tcn-ezj.pages.dev](https://tcn-ezj.pages.dev) - Cloudflare **Pages** · 한국어(`/ko/`)·영어(`/en/`) 정적 사이트. 갱신되지 않으며 참고용으로만 남아 있습니다.
- **성격**: 영어 단일 사이트 + 인증 기반 글쓰기 CMS. 콘텐츠는 Cloudflare **D1**(DB)·**R2**(미디어)에 저장됩니다. 세미나 상세 페이지는 D1을 실시간 조회(SSR)하므로 **글을 저장하면 즉시 공개**되고 삭제도 즉시 반영됩니다. 홈·소개·세미나 목록은 정적 페이지라 변경이 최대 15분쯤 뒤에 반영됩니다([`docs/deployment.md`](./docs/deployment.md#정적-공개-페이지와-자동-갱신)).

## 문서 안내

| 보고 싶은 것                                           | 문서                                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------------- |
| 기술 스택 · 디렉터리 구조 · 로컬 실행 · 검증 · AI 도구 | [`docs/development.md`](./docs/development.md)                        |
| 콘텐츠 위치 · 글 등록 영향 범위 · 계정 발급            | [`docs/content-operations.md`](./docs/content-operations.md)          |
| 도메인 · 자동 배포 · 시크릿                            | [`docs/deployment.md`](./docs/deployment.md)                          |
| 복구 · 롤백 · 장애 대응                                | [`docs/operations-runbook.md`](./docs/operations-runbook.md)          |
| 라우트별 렌더 방식 · 데이터 소스                       | [`CONTENT_ARCHITECTURE.md`](./CONTENT_ARCHITECTURE.md)                |
| 디자인 토큰 · 결정 기록                                | [`DESIGN.md`](./DESIGN.md)                                            |
| 기획 배경 · 회원 가입 흐름                             | [`IDEA.md`](./IDEA.md) · [`MEMBERSHIP_FLOW.md`](./MEMBERSHIP_FLOW.md) |
| 변경 이력 · AI 워크플로 정책                           | [`CHANGELOG.md`](./CHANGELOG.md) · [`AGENTS.md`](./AGENTS.md)         |
| 과거 설계·UI 스냅샷 (날짜별 기록)                      | [`docs/archive/`](./docs/archive/)                                    |

## 단체 소개

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

## 공개 페이지 구조

영어 단일 루트 트리입니다. 실시간으로 D1을 읽는 페이지(`/seminars/**`·`/questions/**`)와 작성자 CMS(`/admin/**`, noindex)는 SSR, 홈·`/about`·`/seminars`(빌드 직전 D1 스냅샷)와 그 밖의 소개 페이지(`/about/*`·`/people`·`/contact`)는 정적 프리렌더입니다. 라우트별 렌더 방식·데이터 소스·구 URL 301 이전은 [`CONTENT_ARCHITECTURE.md` §2](./CONTENT_ARCHITECTURE.md#2-라우트)가 단일 원천입니다.

## 콘텐츠 원칙

- **출처 기반만 수록** - 창립 선언문·정관·확정 자료 근거만 사용.
- **추정·창작 금지** - 미확보 정보는 폴백 처리("To be announced").
- **동의 없는 사진 미노출**.

## 기술 요약

**Astro**(하이브리드 SSR) · **TypeScript** · **Cloudflare Workers + D1 + R2** · **Tailwind** · 어드민 에디터만 **React + Tiptap**. 전 과정이 하나의 Worker에서 동작합니다. 버전은 `package.json`, 계층별 상세와 디렉터리 구조는 [`docs/development.md`](./docs/development.md). 디자인은 50대 후반 이상 독자를 위한 에디토리얼 학술지 톤이며 기준은 [`DESIGN.md`](./DESIGN.md).

## 빠른 시작

```bash
npm ci          # lockfile 기준 의존성 설치
npm run dev     # 개발 서버 (wrangler platformProxy로 로컬 D1/R2 바인딩)
npm run test    # Vitest 유닛 테스트 (커버리지)
npm run check   # astro check (타입·스키마)
npm run build   # dist/ 빌드
```

- Node.js는 `.nvmrc`(26)를 따릅니다(`nvm use`). 로컬 시크릿은 `.dev.vars`(커밋 제외, 키 목록은 `.env.example`).
- 전체 명령·브라우저 검증(`verify`·`a11y` 등)은 [`docs/development.md`](./docs/development.md#로컬-실행).
- `main` 머지 시 자동 배포됩니다. 흐름과 시크릿은 [`docs/deployment.md`](./docs/deployment.md).
- 새 세미나·글은 개발자 없이 작성자가 `/admin`에서 등록하면 즉시 공개됩니다. [`docs/content-operations.md`](./docs/content-operations.md).
