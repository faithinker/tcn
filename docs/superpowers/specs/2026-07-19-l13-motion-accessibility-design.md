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

1. `<head>` 인라인 스크립트가 페인트 전에 `document.documentElement.classList.add('js')` 실행.
2. CSS는 `html.js [data-reveal]`에만 초기 은닉 적용 → **JS 실패·구형 브라우저·크롤러는 처음부터 완전 표시**.
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

```css
html.js [data-reveal] {
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.7s cubic-bezier(.22,.61,.36,1),
              transform 0.7s cubic-bezier(.22,.61,.36,1);
  will-change: opacity, transform;
}
html.js [data-reveal].is-visible {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  html.js [data-reveal] {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

### 4.3 적용 입도 = 섹션 단위

- 카드·행 개별이 아니라 **섹션 래퍼 한 덩어리**에만 부여(차분함 유지).
- `SectionTile.astro`에 `reveal` prop(기본 `true`) 추가 → `data-reveal` 자동 스탬프.
- SectionTile을 안 쓰는 섹션(각 페이지 hero 아래 블록, People 그룹, Seminars Upcoming/Past, Contact 블록, Events 리스트)엔 `data-reveal` 직접.
- **Hero/마스트헤드/Header/Footer는 제외** — 접힘 위 첫 화면은 로드부터 단단히 고정(권위). 리빌은 둘째 섹션부터 시작.

### 4.4 파일

| 파일 | 변경 |
|---|---|
| `src/styles/global.css` | §4.2 reveal CSS + reduced-motion 가드 |
| `src/scripts/reveal.ts` (신규) | `.js` 클래스 부여 + IntersectionObserver 로직 |
| `src/layouts/BaseLayout.astro` | head 인라인 `.js` 스크립트, `reveal.ts` 로드 |
| `src/components/SectionTile.astro` | `reveal` prop → `data-reveal` |
| `src/pages/*.astro` (ko 7 + en 미러) | 접힘 아래 섹션에 `data-reveal` |

## 5. Part B — 접근성 (Lighthouse 주도)

### 5.1 확정 수정 1건 — 다크 표면 포커스 링

Footer는 `bg-ink`(#141414). 전역 `:focus-visible { outline: 2px solid var(--color-accent) }`의 accent(#0b3d6b)는 near-black 위에서 대비 부족 → 포커스 가시성 미달.

수정: 다크 표면에서 밝은 링으로 전환.

```css
.on-dark :focus-visible,
.bg-ink :focus-visible {
  outline-color: var(--color-canvas); /* 흰 링 */
}
```

Footer 루트에 훅 클래스 부여(또는 `footer :focus-visible` 셀렉터). 정확한 셀렉터는 구현 시 Footer 마크업에 맞춤.

### 5.2 측정 → 델타 수정 루프

1. `npm run a11y` 실행 → 대표 페이지 Lighthouse accessibility JSON.
2. 90 미만 페이지의 실패 audit 목록화(대비·라벨·heading 순서·target-size 등).
3. 소스에서 수정(임의 추정 금지, 실패 audit 근거).
4. 재측정 → 전 페이지 ≥90까지 반복.

## 6. 측정 하네스

- devDep: `lighthouse` 추가.
- 신규 `scripts/a11y.mjs`: `npm run preview`(빌드본) 기동 → 각 대표 URL에 `lighthouse --only-categories=accessibility --output=json` → 점수·실패 audit 요약 출력, 하나라도 <90이면 비정상 종료(루프 게이트).
- Chrome: 기존 Playwright 크로미움 재사용(`CHROME_PATH` 지정) → 별도 브라우저 설치 리스크 회피.
- `package.json` script: `"a11y": "node scripts/a11y.mjs"`.

## 7. 테스트 (Playwright)

기존 `scripts/verify.mjs` 하네스와 동일 스택.

1. **진입 리빌**: 하단 `[data-reveal]` 섹션이 초기 `opacity:0` → 스크롤 후 `.is-visible` + `opacity:1`.
2. **reduced-motion**: `emulateMedia({ reducedMotion: 'reduce' })` → `[data-reveal]`가 스크롤 전부터 `opacity:1`.
3. **no-JS 폴백**: JS 비활성 컨텍스트에서 `[data-reveal]` 표시(`opacity:1`).
4. **Hero 제외**: 접힘 위 hero엔 `data-reveal` 없음(로드부터 표시).

## 8. 검증 순서 (완료 정의)

1. `npm run build` 무에러.
2. Playwright 모션 테스트 4종 통과.
3. `npm run a11y` → 대표 페이지 전부 accessibility ≥90.
4. 375/768/1280 스크린샷 무깨짐, 콘솔 무에러.
5. `git commit` (`L13: motion + accessibility`).

## 9. 리스크 / 결정

- **Lighthouse Chrome 의존**: 크로미움 경로 문제 시 `chrome-launcher` 기본 탐색 폴백, 그래도 실패면 라이브 URL(`tcn-ezj.pages.dev`) 대상 측정으로 대체.
- **FOUC 방지**: `.js` 클래스는 반드시 head 인라인·동기 스크립트로 첫 페인트 전에 부여(외부 모듈 지연 로드 금지).
- **모션 세기**: 4px/0.7s로 확정. 무게감 우선, 언제든 CSS 상수만으로 재조정 가능.
- **스코프 규율**: Part B는 Lighthouse 실패 audit에 한정. 점수와 무관한 리팩터링 금지.
