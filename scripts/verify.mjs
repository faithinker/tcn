// scripts/verify.mjs — TCN 루프 검증 하네스
// 목적: 각 라우트를 375/768/1280에서 렌더 → (1)콘솔/페이지 에러 (2)가로 오버플로 (3)HTTP 상태 검사 + 스크린샷 저장.
// 전제: preview/dev 서버가 BASE_URL(기본 localhost:4321)에 떠 있어야 함.
// 사용: BASE_URL=http://localhost:4321 ROUTES=/,/about,/people,/seminars,/contact node scripts/verify.mjs
// 종료코드: 실패 1건 이상이면 1 (루프 Done 게이트). 통과 시 0.
// 산출물: verify/<route>-<width>.png  → 에이전트가 Read로 육안 확인.
// 폰트/네트워크 로드 대기 후 촬영. 셀프호스팅 폰트라 외부 요청 없음.

import { mkdirSync } from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('❌ playwright 미설치. `npm i -D playwright@latest`(node26은 ≥1.60.0 필수) + `npx playwright install chromium`. 폴백: puppeteer-core@25.3.0 + 설치된 Chrome(executablePath/channel:chrome).');
  process.exit(2);
}

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const ROUTES = (process.env.ROUTES || '/,/about,/people,/seminars,/contact').split(',').map(s => s.trim()).filter(Boolean);
const WIDTHS = (process.env.WIDTHS || '375,768,1280').split(',').map(Number);

mkdirSync('verify', { recursive: true });
const browser = await chromium.launch();
let fail = 0;
const results = [];

for (const route of ROUTES) {
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

    let status = 0, overflow = false, note = '';
    try {
      const resp = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 20000 });
      status = resp ? resp.status() : 0;
      // L13: 스크롤 진입 리빌을 발화시킨 뒤 촬영(접힘 아래 섹션이 캡처에 보이도록).
      await page.evaluate(async () => {
        const step = Math.floor(window.innerHeight * 0.8);
        for (let y = 0; y <= document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(800); // 폰트/모션 전환 안정화
      overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const name = (route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '_')) + '-' + w;
      await page.screenshot({ path: `verify/${name}.png`, fullPage: true });
      note = `screenshot=verify/${name}.png`;
    } catch (e) {
      note = 'GOTO_FAIL: ' + e.message;
    }

    const bad = status >= 400 || status === 0 || overflow || errors.length > 0;
    const line = `${bad ? '❌' : '✅'} ${route} @${w}  status=${status} overflow=${overflow} console=${errors.length ? errors.join(' | ') : 'clean'}  ${note}`;
    results.push(line);
    console.log(line);
    if (bad) fail++;
    await ctx.close();
  }
}

await browser.close();
console.log('\n' + (fail ? `FAIL: ${fail}/${ROUTES.length * WIDTHS.length} check(s) — 위 ❌ 확인` : `PASS: all ${ROUTES.length}×${WIDTHS.length} route/width checks`));
process.exit(fail ? 1 : 0);
