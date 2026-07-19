# L13 — 모션 + 접근성 설계

작성일: 2026-07-19
대상: `/Users/jhkim/Desktop/work/tcn` (main)
근거 계획: `Obsidian/tcn/dev/TCN 사이트 — 메뉴 구조 & 루프 실행 계획.md` §L13
디자인 토큰: `DESIGN.md`

## 1. 목표

배포된 사이트에 **절제된 스크롤 진입 모션**을 더하고, **Lighthouse 접근성 감사**로 잔여 결함을 잡아 완료 게이트를 채운다.

모션 톤: 국제 학술단체에 맞는 무게감. 요소가 미끄러지지 않고 **종이에 잉크가 앉듯** 조용히 나타난다. 화려함·순차 등장·스케일·패럴랙스는 배제한다.

### 완료 게이트 (수용 기준)

- `npm run build` 무에러.
- 대표 페이지 **Lighthouse accessibility ≥ 90**: `/ /about /people /seminars /contact /events` + `/en/`.
- `prefers-reduced-motion: reduce`에서 진입 모션 완전 off.
- JS 미동작·구형 브라우저에서 콘텐츠가 절대 숨지 않음(처음부터 표시).
- 375 / 768 / 1280 무깨짐, 콘솔 무에러.

## 2. 범위

**포함**
- 스크롤 진입 페이드(IntersectionObserver 점진적 향상) + `prefers-reduced-motion` 존중.
- Lighthouse a11y 측정 하네스 신설.
- 측정으로 드러난 a11y 결함 수정(≥90까지). 사전 확정 결함 1건: 다크 표면 포커스 링.

**제외**
- 히어로/마스트헤드 모션(의도적 정지 — §4.3).
- 호버 마이크로인터랙션, 페이지 전환 애니메이션, 로딩 스피너.
- 성능(perf) 최적화 — L14 소관.
- 이미지 alt 대응 — 사이트는 텍스트 전용, `<img>` 없음.

## 3. 접근성 베이스라인 (실측 2026-07-19)

이미 구현되어 **손대지 않는** 항목:

| 항목 | 상태 | 위치 |
|---|---|---|
| 스킵 링크 "본문 바로가기 / Skip to content" | ✅ | `BaseLayout.astro:84`, `ui.ts common.skipToContent` |
| `<html lang>` ko/en 동적 | ✅ | `BaseLayout.astro:50` |
| hreflang ko/en/x-default | ✅ | `BaseLayout.astro:60` |
| 포커스 링 `:focus-visible` 2px accent | ✅ | `global.css:128` |
| 탭타깃 ≥48px(내비·버튼), 44px(드롭다운·언어) | ✅ | `Button.astro`, `Header.astro` |
| `<header>/<footer>` 랜드마크 + `<nav aria-label>` | ✅ | `Header.astro:69,77`, `Footer.astro:23,33` |
| 햄버거 버튼 `aria-expanded`/`aria-controls`/`aria-label` + JS 토글 | ✅ | `Header.astro:149,216` |
| 이미지 없음(텍스트 전용) → alt 이슈 없음 | ✅ | — |

→ Part B는 신규 대량 작업이 아니라 **측정 후 델타 수정**이다.

## 4. Part A — 스크롤 진입 모션

### 4.1 원리 (점진적 향상 — 콘텐츠 절대 안 숨김)

1. 리빌 모듈이 대상 관찰 등록을 완료한 뒤 `document.documentElement.classList.add('reveal-ready')` 실행.
2. CSS는 `html.reveal-ready [data-reveal]`에만 초기 은닉 적용 → **JS 실패·구형 브라우저·크롤러는 처음부터 완전 표시**.
3. 단일 `IntersectionObserver`가 모든 `[data-reveal]` 관찰 → 진입 시 `.is-visible` 부여 후 관찰 해제(1회성, 역방향 없음).
4. `matchMedia('(prefers-reduced-motion: reduce)').matches`면 관찰 스킵. CSS 미디어쿼리가 즉시 표시 + transition 제거로 이중 보장.

### 4.2 모션 스펙 ("잉크가 종이에 앉는" 절제)

| 속성 | 값 |
|---|---|
| 주 효과 | `opacity: 0 → 1` |
| 보조 이동 | `translateY(4px → 0)` (거의 정지, 슬라이드감 없음) |
| 지속·이징 | `0.7s cubic-bezier(.22,.61,.36,1)` (감속 — 조용히 내려앉음) |
| 스태거 | 없음 (섹션 통째로 한 번) |
| 스케일·블러·패럴랙스 | 전부 배제 |
| 반복 | 1회, 역방향 없음 (스크롤 위아래 깜빡임 없음) |
| 발화 시점 | 약 15% 노출(`threshold: 0.15`) + 하단 `rootMargin: 0px 0px -8%` |

CSS 골격:

최적화: `[data-reveal]` 전체에 `will-change`를 걸면 요소마다 컴포지터 레이어가 상주해 메모리를 낭비한다. 짧은 1회 opacity/transform 페이드는 힌트 없이도 컴포지터가 처리하므로 **`will-change` 미사용**.

```css
html.reveal-ready [data-reveal] {
  opacity: 0;
  transform: translateY(4px);
}
html.reveal-ready [data-reveal].is-visible {
  opacity: 1;
  transform: none;
  transition: opacity 0.7s cubic-bezier(.22,.61,.36,1),
              transform 0.7s cubic-bezier(.22,.61,.36,1);
}
@media (prefers-reduced-motion: reduce) {
  html.reveal-ready [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

### 4.3 적용 입도 = 섹션 단위 (구조 선택자, 마크업 속성 불필요)

- 리빌 대상은 **`main` 직속 `<section>` 중 2번째부터**. 카드·행 개별이 아니라 섹션 덩어리 단위(차분함).
- **첫 섹션(hero)·Header·Footer는 제외** — 접힘 위 첫 화면은 로드부터 단단히 고정(권위). 리빌은 둘째 섹션부터.
- 모든 페이지가 `hero <section>` + `SectionTile(<section>)` 구조이고, `en/` 페이지는 ko 페이지 컴포넌트를 그대로 재-import(`import HomePage from '../index.astro'`)하므로 **구조 선택자 하나로 ko·en·events·declaration 전부 균일 커버**. `data-reveal` 속성이나 SectionTile prop, 페이지별 편집이 전혀 필요 없다(최적화·최소 표면적).

### 4.4 파일 (3개만)

| 파일 | 변경 |
|---|---|
| `src/styles/global.css` | §4.2 reveal CSS(구조 선택자) + reduced-motion 가드 + 다크 포커스 링 |
| `src/scripts/reveal.ts` (신규) | IntersectionObserver 로직(노출 즉시 unobserve, 완료 시 disconnect) |
| `src/layouts/BaseLayout.astro` | `reveal.ts` 로드 |

SectionTile·개별 페이지·en 미러는 **손대지 않음**.

## 5. Part B — 접근성 (Lighthouse 주도)

### 5.1 확정 수정 1건 — 다크 표면 포커스 링

Footer는 `bg-ink`(#141414). 전역 `:focus-visible { outline: 2px solid var(--color-accent) }`의 accent(#0b3d6b)는 near-black 위에서 대비 부족 → 포커스 가시성 미달.

수정: 다크 표면에서 밝은 링으로 전환.

```css
footer :focus-visible {
  outline-color: var(--color-canvas); /* 잉크블랙 위 흰 링 */
}
```

### 5.2 측정 → 델타 수정 루프

1. `npm run a11y` 실행 → 대표 페이지 Lighthouse accessibility JSON.
2. 90 미만 페이지의 실패 audit 목록화(대비·라벨·heading 순서·target-size 등).
3. 소스에서 수정(임의 추정 금지, 실패 audit 근거).
4. 재측정 → 전 페이지 ≥90까지 반복.

## 6. 측정 하네스

- devDep: `lighthouse` + `chrome-launcher` 추가.
- 신규 `scripts/a11y.mjs`: preview(빌드본) 대상 각 대표 URL에 `lighthouse`(accessibility 카테고리만) 실행 → 점수·실패 audit 요약, 하나라도 `MIN_A11Y`(기본 90) 미만이면 비정상 종료(루프 게이트).
- Chrome: 시스템 Google Chrome을 `chrome-launcher`가 자동 탐색(headless).
- `package.json` scripts: `"a11y": "node scripts/a11y.mjs"`, `"motion": "node scripts/motion.mjs"`.

## 7. 테스트 (Playwright — `scripts/motion.mjs`)

기존 `scripts/verify.mjs`와 동일 스택. 짧은 뷰포트(500px)로 2번째 섹션을 접힘 아래에 두고 검사.

1. **준비 상태**: 관찰 등록 뒤 `html.reveal-ready` 클래스가 설정됨.
2. **Hero 표시**: hero에 `data-reveal`이 없고 `opacity:1`.
3. **진입 리빌**: 2번째 섹션 초기 `opacity:0` → `scrollIntoView` 후 `opacity:1`.
4. **reduced-motion**: `reducedMotion: 'reduce'` → 2번째 섹션이 스크롤 전부터 `opacity:1`.
5. **no-JS 폴백**: `javaScriptEnabled: false` → 2번째 섹션 `opacity:1`(콘텐츠 안 숨김).

추가로 `verify.mjs`는 촬영 전 페이지를 스텝 스크롤해 리빌을 발화시킨 뒤 fullPage 캡처(접힘 아래 섹션이 스크린샷에 보이도록).

## 8. 검증 순서 (완료 정의)

1. `npm run build` 무에러.
2. `npm run motion` 5종 통과.
3. `npm run a11y` → 대표 페이지 전부 accessibility ≥90.
4. `npm run verify` 375/768/1280 무깨짐, 콘솔 무에러.
5. `git commit` (`L13: motion + accessibility`).

## 9. 리스크 / 결정

- **Lighthouse Chrome 의존**: `chrome-launcher`가 시스템 Google Chrome 자동 탐색(macOS 확인됨). 부재 환경(CI 등)에선 라이브 URL(`tcn-ezj.pages.dev`) 대상 측정으로 대체.
- **실패 안전성 우선**: 관찰 등록 완료 전에는 `.reveal-ready`를 부여하지 않아 모듈 실패 시 콘텐츠가 숨지 않게 한다.
- **모션 세기**: 4px/0.7s로 확정. 무게감 우선, 언제든 CSS 상수만으로 재조정 가능.
- **스코프 규율**: Part B는 Lighthouse 실패 audit에 한정. 점수와 무관한 리팩터링 금지.
