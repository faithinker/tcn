// scripts/motion.mjs — L13 스크롤 진입 모션 검증 (Playwright).
// 전제: preview 서버가 BASE_URL(기본 localhost:4321)에 떠 있어야 함.
// 검사: (1)html.js 부여 (2)hero 항상 표시 (3)하위 섹션 스크롤 전 은닉→후 표시
//       (4)reduced-motion서 즉시 표시 (5)JS 미동작 시 표시.
// 종료코드: 실패 1건 이상이면 1.

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const browser = await chromium.launch();
let fail = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fail++;
};
const op = (page, sel, nth = 0) =>
  page.evaluate(
    ([s, n]) => {
      const el = document.querySelectorAll(s)[n];
      return el ? getComputedStyle(el).opacity : null;
    },
    [sel, nth],
  );

// 짧은 뷰포트 → 2번째 섹션이 접힘 아래에 위치하도록.
const VP = { width: 1280, height: 500 };

// 1) 기본 동작
{
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  await page.goto(BASE + '/ko/', { waitUntil: 'load' });
  await page.waitForTimeout(200);

  const hasJs = await page.evaluate(() => document.documentElement.classList.contains('js'));
  check(hasJs, 'html.js 클래스 부여됨 (페인트 전 인라인 스크립트)');

  check((await op(page, 'main > section', 0)) === '1', 'hero(첫 섹션) 항상 표시');

  const beforeScroll = await op(page, 'main > section', 1);
  check(beforeScroll === '0', `2번째 섹션 스크롤 전 은닉 (opacity=${beforeScroll})`);

  await page.evaluate(() =>
    document.querySelectorAll('main > section')[1].scrollIntoView({ block: 'center' }),
  );
  await page.waitForFunction(
    () => {
      const el = document.querySelectorAll('main > section')[1];
      return el && getComputedStyle(el).opacity === '1';
    },
    { timeout: 2000 },
  ).catch(() => {});
  const afterScroll = await op(page, 'main > section', 1);
  check(afterScroll === '1', `2번째 섹션 스크롤 후 표시 (opacity=${afterScroll})`);

  await ctx.close();
}

// 2) prefers-reduced-motion → 스크롤 전에도 표시, 모션 off
{
  const ctx = await browser.newContext({ viewport: VP, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/ko/', { waitUntil: 'load' });
  await page.waitForTimeout(200);
  const val = await op(page, 'main > section', 1);
  check(val === '1', `reduced-motion: 2번째 섹션 스크롤 전 즉시 표시 (opacity=${val})`);
  await ctx.close();
}

// 3) JS 미동작 폴백 → 모든 섹션 표시
{
  const ctx = await browser.newContext({ viewport: VP, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/ko/', { waitUntil: 'load' });
  const val = await op(page, 'main > section', 1);
  check(val === '1', `no-JS: 2번째 섹션 표시(콘텐츠 안 숨김) (opacity=${val})`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (fail ? `FAIL: ${fail} check(s)` : 'PASS: all motion checks'));
process.exit(fail ? 1 : 0);
