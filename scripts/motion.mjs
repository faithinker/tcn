// scripts/motion.mjs — L13 스크롤 진입 모션 검증 (Playwright).
// 전제: preview 서버가 BASE_URL(기본 localhost:4321)에 떠 있어야 함.
// 검사: (1)초기화 준비 상태 (2)hero 항상 표시 (3)하위 섹션 스크롤 전 은닉→후 표시
//       (4)reduced-motion서 즉시 표시 (5)JS 미동작/초기화 실패 시 표시.
// 종료코드: 실패 1건 이상이면 1.

import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const browser = await chromium.launch();
let fail = 0;
const check = (cond, msg) => {
  console.log(`${cond ? '✅' : '❌'} ${msg}`);
  if (!cond) fail++;
};
const op = (locator) => locator.evaluate((el) => getComputedStyle(el).opacity);

// 짧은 뷰포트 → 2번째 섹션이 접힘 아래에 위치하도록.
const VP = { width: 1280, height: 500 };

// 1) 기본 동작
{
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const hero = page.locator('main > section').first();
  const target = page.locator('[data-reveal]').last();

  const isReady = await page.evaluate(() => document.documentElement.classList.contains('reveal-ready'));
  check(isReady, '리빌 모듈 초기화 후 reveal-ready 클래스 부여됨');

  check(!(await hero.getAttribute('data-reveal')), 'hero에 data-reveal 없음');
  check((await op(hero)) === '1', 'hero(첫 섹션) 항상 표시');

  const isOffscreen = await target.evaluate((el) => el.getBoundingClientRect().top >= window.innerHeight);
  check(isOffscreen, '검사 대상이 스크롤 전 뷰포트 밖에 있음');
  const beforeScroll = await op(target);
  check(beforeScroll === '0', `하단 섹션 스크롤 전 은닉 (opacity=${beforeScroll})`);

  await target.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => {
      const elements = document.querySelectorAll('[data-reveal]');
      const el = elements[elements.length - 1];
      return el && getComputedStyle(el).opacity === '1';
    },
    { timeout: 2000 },
  ).catch(() => {});
  const afterScroll = await op(target);
  check(afterScroll === '1', `하단 섹션 스크롤 후 표시 (opacity=${afterScroll})`);

  await ctx.close();
}

// 2) prefers-reduced-motion → 스크롤 전에도 표시, 모션 off
{
  const ctx = await browser.newContext({ viewport: VP, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const target = page.locator('[data-reveal]').last();
  const val = await op(target);
  check(val === '1', `reduced-motion: 하단 섹션 스크롤 전 즉시 표시 (opacity=${val})`);
  await ctx.close();
}

// 3) JS 미동작 폴백 → 모든 섹션 표시
{
  const ctx = await browser.newContext({ viewport: VP, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const val = await op(page.locator('[data-reveal]').last());
  check(val === '1', `no-JS: 하단 섹션 표시(콘텐츠 안 숨김) (opacity=${val})`);
  await ctx.close();
}

// 4) IntersectionObserver 초기화 실패 → 준비 클래스 미부여, 모든 섹션 표시
{
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.IntersectionObserver = class {
      constructor() {
        throw new Error('forced IntersectionObserver init failure');
      }
    };
  });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  const isReady = await page.evaluate(() => document.documentElement.classList.contains('reveal-ready'));
  const val = await op(page.locator('[data-reveal]').last());
  check(!isReady, '관찰자 초기화 실패 시 reveal-ready 미부여');
  check(val === '1', `초기화 실패: 하단 섹션 표시 (opacity=${val})`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (fail ? `FAIL: ${fail} check(s)` : 'PASS: all motion checks'));
process.exit(fail ? 1 : 0);
