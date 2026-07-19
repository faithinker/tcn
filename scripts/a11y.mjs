// scripts/a11y.mjs — L13 접근성 측정 게이트 (Lighthouse accessibility 카테고리만).
// 전제: preview 서버가 BASE_URL(기본 localhost:4321)에 떠 있어야 함.
// 사용: BASE_URL=http://localhost:4321 node scripts/a11y.mjs
// 종료코드: 한 라우트라도 MIN_A11Y 미만이면 1 (루프 Done 게이트). 통과 시 0.

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const ROUTES = (process.env.ROUTES || '/,/about,/people,/seminars,/contact,/events,/en/')
  .split(',').map((s) => s.trim()).filter(Boolean);
const MIN = Number(process.env.MIN_A11Y || 90);

const chrome = await launch({ chromeFlags: ['--headless=new', '--no-sandbox'] });
let fail = 0;
const summary = [];

try {
  for (const route of ROUTES) {
    const url = BASE + route;
    const { lhr } = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: ['accessibility'],
      output: 'json',
      logLevel: 'error',
    });
    const score = Math.round(lhr.categories.accessibility.score * 100);
    const failed = lhr.categories.accessibility.auditRefs
      .map((r) => lhr.audits[r.id])
      .filter((a) => a && a.score !== null && a.score < 1)
      .map((a) => a.id);
    const bad = score < MIN;
    const line = `${bad ? '❌' : '✅'} ${route}  a11y=${score}  fail:[${failed.join(', ') || 'none'}]`;
    summary.push(line);
    console.log(line);
    if (bad) fail++;
  }
} finally {
  await chrome.kill();
}

console.log('\n' + (fail
  ? `FAIL: ${fail}/${ROUTES.length} route(s) < ${MIN} — 위 fail audit 수정 필요`
  : `PASS: all ${ROUTES.length} routes ≥ ${MIN} accessibility`));
process.exit(fail ? 1 : 0);
