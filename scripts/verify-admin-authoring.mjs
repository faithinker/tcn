// 관리자 저작 플로우 브라우저 게이트.
// 로그인 → 글 생성 → 본문 작성 → 이미지 업로드/캡션/정렬 → 저장 → 공개 반영 → 삭제까지
// 실제 브라우저로 밟는다. PostEditor 구조 변경(분해 등) 전후로 이 게이트가 같은 초록이면
// "행동 불변"이 증명된다. 전제: wrangler dev(:4321) + 로컬 D1 마이그레이션/시드.
//
// 멱등: 계정은 시작 시 삭제 후 재생성, 글은 마지막에 soft delete(가시 event_date 유니크
// 인덱스는 visible 행만 대상이라 재실행 충돌 없음).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const USERNAME = 'verify-admin-gate';
const PASSWORD = 'verify-Admin-2100!gate';
// 시드 최대 개최일(browser-media 시드 2099-12-31)보다 뒤 — event_date_must_follow_latest 회피.
const EVENT_DATE = '2100-01-15';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', 'wrangler');

const failures = [];
function check(label, condition) {
  if (condition) {
    console.log(`✅ ${label}`);
    return;
  }
  failures.push(label);
  console.error(`❌ ${label}`);
}

function d1(sql) {
  execFileSync(WRANGLER, ['d1', 'execute', 'tcn-content', '--local', '--command', sql], {
    cwd: ROOT,
    stdio: 'pipe',
  });
}

// 계정 준비(멱등). 해시 포맷은 create-user.mjs가 password.ts와 동일하게 만든다.
d1(`DELETE FROM users WHERE username='${USERNAME}';`);
execFileSync(process.execPath, ['scripts/create-user.mjs', USERNAME, PASSWORD], {
  cwd: ROOT,
  stdio: 'pipe',
});

const browser = await chromium.launch();
const consoleErrors = [];

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  // A1 — 미인증 접근은 로그인으로 보낸다.
  await page.goto(`${BASE}/admin/posts/new`, { waitUntil: 'domcontentloaded' });
  check(
    '미인증 /admin/posts/new 는 로그인으로 리다이렉트된다',
    page.url().includes('/admin/login'),
  );

  // A2 — 실제 로그인 폼 제출로 세션을 얻는다.
  await page.fill('input[name="username"]', USERNAME);
  await page.fill('input[name="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL('**/admin', { timeout: 15_000 }),
    page.click('#login-form button[type="submit"]'),
  ]);
  check('로그인 후 /admin 글 목록에 도착한다', page.url().endsWith('/admin'));

  // A3 — 제목+개최일만으로 생성하면 편집 화면으로 전환된다(미디어 첨부 가능 상태).
  await page.goto(`${BASE}/admin/posts/new`, { waitUntil: 'domcontentloaded' });
  // client:load 아일랜드가 하이드레이션을 마쳐야 버튼 핸들러가 붙는다(Astro는 완료 시 ssr 속성 제거).
  // astro-island 는 display:contents 라 playwright 의 visible 판정에 걸리지 않는다 — 속성으로 대기.
  await page.waitForFunction(
    () => {
      const island = document.querySelector('astro-island');
      return island !== null && !island.hasAttribute('ssr');
    },
    { timeout: 15_000 },
  );
  await page.fill('#post-title', 'Gate seminar (automated)');
  await page.fill('#post-event-date', EVENT_DATE);
  await page.getByRole('button', { name: 'Create' }).click();
  // 글롭 '**/admin/posts/*' 는 현재 /admin/posts/new 에도 매치되므로 UUID 경로를 정규식으로 기다린다.
  await page
    .waitForURL(/\/admin\/posts\/(?!new$)[0-9a-f-]+$/, { timeout: 15_000 })
    .catch(async () => {
      const statusText = await page.locator('[role="status"]').textContent();
      throw new Error(`생성이 편집 화면으로 이동하지 않음 — 상태: "${statusText}"`);
    });
  check(
    '생성 직후 편집 화면(/admin/posts/{id})으로 이동한다',
    /\/admin\/posts\/(?!new$)[0-9a-f-]+$/.test(page.url()),
  );

  const status = page.locator('[role="status"]');
  const savedOk = async () => {
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForFunction(
      (el) => el.textContent?.includes('Saved ✓') || el.textContent?.includes('failed'),
      await status.elementHandle(),
      { timeout: 15_000 },
    );
    return (await status.textContent())?.includes('Saved ✓') === true;
  };

  // A4 — Tiptap 본문 입력 → 저장.
  await page.click('.admin-prose');
  await page.keyboard.type('Automated gate body paragraph. It must appear on the public page.');
  check('본문 입력 후 저장이 Saved ✓ 로 끝난다', await savedOk());

  // A5 — 이미지 2건 업로드(파일명이 달라야 정렬 검증 가능).
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(path.join(ROOT, 'scripts/fixtures/upload-sample.webp'));
  await page.waitForFunction(
    (el) => /uploaded ✓|failed/.test(el.textContent ?? ''),
    await status.elementHandle(),
    { timeout: 30_000 },
  );
  await fileInput.setInputFiles(path.join(ROOT, 'src/assets/founding/founding-video-poster.jpg'));
  await page.waitForFunction(
    (el) => /uploaded ✓|failed/.test(el.textContent ?? ''),
    await status.elementHandle(),
    { timeout: 30_000 },
  );
  const imageItems = page.locator('section[aria-labelledby="media-images-heading"] ul > li');
  check('이미지 2건이 그리드에 나타난다', (await imageItems.count()) === 2);
  check(
    '첫 이미지가 자동으로 대표(★ Cover)로 지정된다',
    (await imageItems.first().getByRole('button', { name: '★ Cover' }).count()) === 1,
  );

  // A6 — 캡션 입력 → 저장 → 재로드 후 유지.
  await imageItems.first().getByRole('button', { name: 'Add caption' }).click();
  await imageItems.first().locator('input[id^="media-caption-"]').fill('Automated gate caption');
  check('캡션 입력 후 저장이 성공한다', await savedOk());
  await page.reload({ waitUntil: 'domcontentloaded' });
  check(
    '재로드 후 캡션이 유지된다',
    (await page.locator('input[id^="media-caption-"]').first().inputValue()) ===
      'Automated gate caption',
  );

  // A7 — 두 번째 이미지를 앞으로 이동 → 저장 → 재로드 후 순서 유지.
  const filenamesBefore = await page
    .locator('section[aria-labelledby="media-images-heading"] li p.truncate')
    .allTextContents();
  await page
    .getByRole('button', { name: /^Move .* earlier$/ })
    .nth(1)
    .click();
  check('순서 이동 후 저장이 성공한다', await savedOk());
  await page.reload({ waitUntil: 'domcontentloaded' });
  const filenamesAfter = await page
    .locator('section[aria-labelledby="media-images-heading"] li p.truncate')
    .allTextContents();
  check(
    '재로드 후 이미지 순서가 스왑되어 있다',
    filenamesAfter.length === 2 &&
      filenamesAfter[0] === filenamesBefore[1] &&
      filenamesAfter[1] === filenamesBefore[0],
  );

  // A9 — readiness 패널: 날짜·본문·사진·대표 충족 반영(7항목 중 ≥5 = 71% 이상).
  const readinessText = await page
    .locator('aside[aria-label="Public page readiness"] p.font-serif')
    .first()
    .textContent();
  const readinessPercent = Number((readinessText ?? '').replace(/[^0-9]/g, ''));
  check(
    `readiness 퍼센트가 충족 항목을 반영한다 (${readinessPercent}% ≥ 71%)`,
    readinessPercent >= 71,
  );

  // A8 — 공개 페이지 반영.
  const publicPage = await context.newPage();
  publicPage.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  publicPage.on('pageerror', (e) => consoleErrors.push(String(e)));
  const publicResponse = await publicPage.goto(`${BASE}/seminars/${EVENT_DATE}`, {
    waitUntil: 'domcontentloaded',
  });
  check('공개 상세가 200으로 열린다', publicResponse?.status() === 200);
  check(
    '본문 문단이 공개 페이지에 노출된다',
    await publicPage
      .getByText('Automated gate body paragraph', { exact: false })
      .first()
      .isVisible(),
  );
  check(
    '업로드한 이미지가 공개 페이지에 노출된다',
    (await publicPage.locator('img[src^="/media/"]').count()) >= 1,
  );
  await publicPage.close();

  // A10 — 삭제(soft delete) → 공개 404.
  page.on('dialog', (dialog) => dialog.accept());
  // 미디어 항목에도 Delete 버튼이 있다 — 글 삭제 버튼은 Save·상태 표시줄과 같은 행에 있다.
  await Promise.all([
    page.waitForURL('**/admin', { timeout: 15_000 }),
    page.locator('div:has(> [role="status"]) > button:text-is("Delete")').click(),
  ]);
  check('삭제 후 /admin 목록으로 돌아온다', page.url().endsWith('/admin'));
  const goneResponse = await page.request.get(`${BASE}/seminars/${EVENT_DATE}`);
  check('삭제된 글의 공개 URL은 404다', goneResponse.status() === 404);

  check(`브라우저 콘솔 에러 0건 (실제 ${consoleErrors.length}건)`, consoleErrors.length === 0);
  if (consoleErrors.length) console.error(consoleErrors.join('\n'));

  await context.close();
} catch (error) {
  failures.push(`검사 실행 오류: ${String(error)}`);
  console.error(error);
} finally {
  await browser.close();
  // 계정 정리(글은 soft delete 완료 상태 유지 — 가시 유니크 인덱스와 충돌 없음).
  try {
    d1(`DELETE FROM users WHERE username='${USERNAME}';`);
  } catch {
    // 정리 실패는 게이트 결과에 영향 없음(다음 실행이 재생성 전에 삭제).
  }
}

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} admin-authoring check(s)`);
  process.exit(1);
}

console.log('\nPASS: all admin-authoring behavior checks');
