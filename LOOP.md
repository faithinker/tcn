# TCN 사이트 빌드 — LOOP (goal + 루프 엔지니어링)

작성: 2026-07-19 · 작업 위치: `/Users/jhkim/Desktop/work/tcn`
상세 스펙(페이지 레이아웃·DESIGN 토큰 매핑): Obsidian `dev/TCN 사이트 — 메뉴 구조 & 루프 실행 계획.md`, `dev/TCN 학회 소개 사이트 — 개발 계획.md`
**시각·CSS 레퍼런스: Obsidian `TCN 사이트맵.html`** — WIRED 스타일 완전 구현본(토큰·컬러·명조+Pretendard·48px 타깃·상태 배지). L2 토큰 이식·컴포넌트 스타일의 실참조. 콘텐츠 인벤토리(8그룹·상태)도 포함.
이 파일 = **/loop가 매 반복 읽는 자족 빌드 스펙 + 진행 상태**.

---

## 🎯 GOAL
**한국어 기본(+영어 옵션)** 정적 소개 사이트를 **DESIGN.md 토큰(WIRED 에디토리얼·명조 세리프)**으로 빌드해 Cloudflare Pages 라이브까지. 콘텐츠 = 실제 확보값(아래 SEED), 미확보는 잠금된 기본값 플레이스홀더. 초기 **텍스트 전용** · **밝은 고대비 단일 테마(노안 대응)**.

## ✅ 성공 기준 (Definition of Done)
- Home · About(연혁·선언문) · People · Seminars(목록+상세) · Contact 한국어 렌더
- 375 / 768 / 1280 반응형, **밝은 고대비 단일 테마**, DESIGN.md 토큰 일관 · **본문 18px·최소 14px·탭타깃 48px(노안)**
- `npm run build` 무에러 · 브라우저 콘솔 무에러
- 자동: L0~L14 / 수동: L15 배포(wrangler 인증)

## 🔒 잠금 결정 (재논의 금지 — 그대로 빌드)
- IA: **5페이지 통합본**(사용자 확정) — Home · About(연혁·선언문·조직개요 통합) · People · Seminars · Contact. 사이트맵 HTML의 8그룹 콘텐츠는 이 5페이지에 흡수(Membership·Research·News는 후속/About 하위)
- 언어: **ko 기본(`/`)** · en 옵션(`/en/`) — `defaultLocale:'ko'`
- 디자인: **WIRED 에디토리얼** — 명조 세리프(헤드라인·본문)=서사 · Pretendard 산세리프=구조 · 종이↔미색(parchment) 밴드 교차 · 단일 액센트 **잉크블루 #0b3d6b** · 잉크블랙 #141414 · 헤어라인 1px · 4px 라운드 · **그림자·그라디언트·다크모드 없음**
- 폰트: **Noto Serif KR(명조 — 헤드라인·본문)** + **Pretendard(UI·내비·메타·버튼)** 셀프호스팅 (Latin 폴백 Playfair/Lora)
- 테마: **밝은 고대비 단일**(다크모드 미사용 — 노안·에디토리얼)
- 이미지: **텍스트 전용** (사진 미게재 → 게재동의 B12 회피)
- 이사 4명: **"추후 공개 / To be announced" + 국가** 카드
- 창립 선언문: **국문 전문 직접 게재**(About #declaration)
- Contact: **"연락처 추후 안내"** (F1 미확보)
- 스택: Astro 5 + Tailwind 4 + Content Collections(Zod) · 자체 컴포넌트(킷 미사용)
- 배포: Cloudflare Pages
- **seed에 literal "[필요]" 금지** — 미확보는 아래 기본값/optional로. 임의 콘텐츠 생성 금지.

---

## 🌱 SEED (실제 콘텐츠 — 이 값으로 시드 파일 생성)

### 정체성 / 미션 (ko 기본)
- 명칭: **초문화네트워크 / Transcultural Network / TCN**
- Hero 구조(**고객 확정 2026-07-19**): **단체명이 focal** — `초문화네트워크`(display-md ~32px, H3) + `Transcultural Network`(display-sm ~26px, H4, muted) 를 크게. 긴 태그라인 *"국가·민족·언어·문화의 경계를 넘어 새로운 제3의 문화를 창조하는 국제 학술 네트워크입니다."* 는 **대형 헤드라인 금지 → lead(21px) 서브헤드로 강등**(1줄, 줄바꿈 강제 없음). eyebrow는 "국제 학술 네트워크".
- 분야(A1): 초문화교류 학술단체 — 디지털·AI 시대 문화 교류·창조를 연구하는 국제 학술단체
- 설립 취지(A3): 국경 없는 디지털·AI 시대에 문화 교류와 새로운 문화 창조가 지속되는 과정을 규명하고, 더 나은 문화 창조에 기여
- 비전(A4): 인류가 공존하고 인간이 존중받는 문화 창조 지향
- 미션(A4): 각국 전문가가 지혜와 경험을 공유
- 핵심 활동(A9): 국제 세미나 개최 · 공동연구 · 인력 교류 · 정책 대안 제시
- 4대 사명(선언문): 연구기반 구축 · 국제 학술협력 · 새로운 문화 창조 · 정책 제언
- 사무국: 대한민국 서울
- 창립 선언문 국문 전문 소스: Obsidian `contents/Transcultural Network 창립 선언문.docx` (textutil 추출). 서명 = 창립준비위원장 = 회장 김원준

### 임원 (members) — category: board
| key | 이름(ko) | 이름(en) | 역할 | 소속 |
|---|---|---|---|---|
| kim | 김원준 | Dr. Wonjoon Kim | 회장 | Kim & Chang 고문 · 前 공정거래위원회 사무처장 (경제학박사 Paris X · 성균관대 경제학 · 창립준비위원장 겸 초대 회장) |
| jeon | 전성호 | Prof. Jeon Sung-ho | 수석부회장 | 한국학중앙연구원 세종국가경영연구소 연구교수 (경제사학·개성 자본회계론 · 성균관대 경제학 박사 · Oxford 방문교수) |
| director-cn | 추후 공개 | To be announced | 이사 | China |
| director-vn | 추후 공개 | To be announced | 이사 | Vietnam |
| director-la | 추후 공개 | To be announced | 이사 | Laos |
| director-uz | 추후 공개 | To be announced | 이사 | Uzbekistan |
| lee | John Lee | John Lee | 감사 | 미국 (소속 추후) |
- Advisors·Members(일반) 그룹: **데이터 0건 → 섹션 숨김**

### 세미나 (seminars)
- **Upcoming** — `s2026-korea` · 2026-10-30 · 제2차 세미나 · 한국 (도시·건물·주제·연사 추후)
- **Past** — `s2025-laos` · 2025-12-26 · 제1차 세미나 · 라오스 루앙프라방 (한·베트남·라오스 전문가; 주제·발표자 추후)
- abstract·speaker 미확보 → Zod `optional`, 상세 페이지 "상세 추후 안내" 폴백
- 창립총회(2025-12-12)는 세미나 아닌 창립 행사 → 연혁에만

### 연혁 (history)
| date | 제목 | 설명 |
|---|---|---|
| 2025-12-12 | 창립 | 성균관대 명륜캠퍼스에서 15개국 전문가가 참여한 창립총회. 정관 심의·창립 선언 |
| 2025-12-26 | 제1차 세미나 | 라오스 루앙프라방, 한·베트남·라오스 전문가 참가 |
| 2026-10-30 | 제2차 세미나(예정) | 한국 개최 예정 |

### 홈 하이라이트 (Stat 4)
- 창립 **2025** · 창립국 **15** · 세미나 **1**(2025) · 사무국 **서울**

---

## 📋 진행 트래커 (매 반복 갱신 — 완료 시 [x] + git commit)
- [x] **L0** git init + .gitignore (node_modules, dist, .astro, **verify/**)
- [x] **L1** Astro 5 스캐폴드 + Tailwind 4 (in-place, non-empty 플래그, 기존 파일 보존) — `npm run build` 무에러
- [x] **L1v** 검증 하네스: `npm i -D playwright@latest`(**≥1.60.0 필수** — 미만은 node26서 브라우저 추출 멈춤; 현재 1.61.1) + `npx playwright install chromium` + `scripts/verify.mjs`(작성됨) + `package.json` script `"verify"`. 스모크: 임시 `/` preview에서 `npm run verify` PASS(스크린샷 생성 확인). **실패 시**: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`+`channel:'chrome'`(설치된 Chrome), 또는 `puppeteer-core@25.3.0`+executablePath
- [x] **L2** DESIGN.md 토큰 → global.css (@theme + `:root` 라이트 단일) + **Noto Serif KR·Pretendard** 셀프호스팅 · 잉크블루 #0b3d6b
- [x] **L3** i18n `defaultLocale:'ko'` + ui.ts(ko 기본, en 옵션) + utils.ts
- [x] **L4** 셸: BaseLayout · Header(종이 nav+하단 블랙 헤어라인, 햄버거) · Footer(잉크블랙 밴드) — *ThemeToggle 없음*
- [ ] **L5** 코어 컴포넌트: Button(primary/outline·4px·≥48px) · SectionTile(hero-band/section-band) · Stat
- [ ] **L6** content.config.ts(Zod, 아래 스키마) + SEED 시드 파일 — `astro check` 통과
- [ ] **L7** Home (Hero·미션·최신세미나·하이라이트·가입CTA·Footer)
- [ ] **L8** About (미션/비전·활동개요·**선언문 국문 전문**·History Timeline)
- [ ] **L9** People (Board: 회장·수석부회장·이사4 TBA·감사 / Advisors·Members 숨김) + MemberCard(이니셜 모노그램)
- [ ] **L10** Seminars 목록 (Upcoming/Past) + SeminarCard
- [ ] **L11** Seminar 상세 `[slug]` (제목·메타·abstract 폴백·back)
- [ ] **L12** Contact ("연락처 추후 안내" + 가입 자리)
- [ ] **L13** 모션(진입 fade, prefers-reduced-motion 존중) + 접근성(포커스링·alt·**터치 48px**·본문 18px) — `.agents` 애니 스킬 활용
- [ ] **L14** SEO(title/desc/OG·sitemap·robots·404·favicon)
- [ ] **L15** 배포 Cloudflare Pages *(수동 — wrangler 인증)*
- [ ] (옵션) **L16** 영어판 `/en/` · (옵션) **L17** News

### Zod 스키마 (L6)
```
seminars: { key, lang, title, date, location, speaker?, affiliation?, abstract?, materialsUrl?, tags? }
members:  { key, lang, name, role, category:'board'|'advisor'|'member', order, affiliation?, photo?, email?, website? }
history:  { key, lang, year?, date, title, description }
```

---

## 🔬 검증 하네스 (준비됨 — 전용 computer-use 대체)
전용 computer-use 툴은 없음 → **헤드리스 Chrome(Playwright) 스크린샷 + 콘솔 캡처 + 에이전트 육안 확인**의 3층 검증:
1. **정적**: `npm run build` · `astro check` — 컴파일/타입 에러 0
2. **런타임**: `scripts/verify.mjs`(Playwright) → 각 라우트 × [375/768/1280] 렌더 → **콘솔/페이지 에러·가로 오버플로·HTTP 상태** 검사, `verify/<route>-<w>.png` 저장, 종료코드로 Pass/Fail
3. **시각**: 에이전트가 `verify/*.png`를 **Read로 열어 육안 판정** — WIRED 토큰(명조·잉크블루·밴드·여백) 적용·레이아웃 무깨짐 (사람 눈 대체)
- 서버: 페이지 검증 시 `astro preview`(또는 dev)를 **백그라운드 기동**(포트 4321) → verify → 종료
- **node v26 핀: `playwright@latest`(≥1.60.0)** — 미만은 브라우저 추출 멈춤(이슈 #40998, 1.60.0 수정). engines는 node≥18이라 `npm i`는 무경고
- 폴백(설치 멈추면): ① `playwright@latest`로 업 ② `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`+`channel:'chrome'`(설치된 Chrome, 다운로드 0) ③ `puppeteer-core@25.3.0`+executablePath. **Chrome `--headless --screenshot`은 콘솔 캡처 불가 → 하네스 부적합**
- lighthouse(a11y≥90/perf≥95)는 CLI 미설치 → 사후 측정, 하드블로커 아님

## 🔁 반복 프로토콜
매 iteration:
1. 트래커에서 **미완료 첫 L단계 1개** 선택 (한 반복 = 한 단계)
2. 그 단계 *Do* 수행 (잠금 결정·SEED 준수, 임의 콘텐츠 금지)
3. *Done* 검증 (3층):
   - ① `npm run build` 무에러 (+ `astro check`)
   - ② **페이지 산출 단계면**: preview 백그라운드 기동 → `ROUTES=<해당 라우트> npm run verify` → **종료코드 0**(콘솔 에러 0·오버플로 0·HTTP<400)
   - ③ 에이전트가 `verify/*.png` **Read로 육안 확인** → WIRED 적용·레이아웃 판정
4. 통과 → 이 파일 체크박스 `[x]` + `git commit -m "L#: <title>"`. 실패 → 원인 수정 후 재검증
5. 다음 반복. **전 단계 [x] 또는 L14 완료 시 종료**(L15는 수동)

## ▶ /loop 실행 프롬프트 (이 텍스트로 루프 구동)
> `LOOP.md`를 읽고, 진행 트래커에서 **미완료 첫 L단계 하나만** 수행하라. 잠금 결정과 SEED를 그대로 따르고 임의 콘텐츠는 만들지 마라. Do 실행 → Done(build 무에러·콘솔 무에러·반응형 무깨짐) 검증 → 통과하면 LOOP.md 해당 체크박스를 `[x]`로 바꾸고 `git commit -m "L#: <title>"`. 한 반복에 한 단계만. 실패하면 원인 수정 후 재검증. L15(배포)는 건너뛰고 사용자에게 알려라.
