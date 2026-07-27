// 창립총회 미디어의 상태 전환 회귀 검사.
// 전제: HTTP Range를 지원하는 `astro dev` 또는 `npm run preview:mobile`을
// BASE_URL에 띄워 둔다.
// 사용: BASE_URL=http://localhost:4321 npm run verify:founding-media
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const failures = [];
const foundingMedia = JSON.parse(readFileSync('src/data/founding-media.json', 'utf8'));

function check(label, condition, detail = '') {
  const suffix = detail ? ` — ${detail}` : '';
  if (condition) {
    console.log(`✅ ${label}${suffix}`);
    return;
  }
  failures.push(`${label}${suffix}`);
  console.error(`❌ ${label}${suffix}`);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const requests = [];
  page.on('request', (request) => requests.push(request.url()));

  await page.goto(`${BASE}/about/founding/`, { waitUntil: 'networkidle' });
  const triggers = page.locator('[data-lightbox-open="founding-record"]');
  check('갤러리에 사진 7장과 영상 1개가 있다', (await triggers.count()) === 8);
  const labelMismatches = await triggers.evaluateAll((nodes) =>
    nodes
      .map((node) => {
        const visibleLabel =
          node.querySelector('.media-hint, .play-label')?.textContent?.trim() ?? '';
        const accessibleName = node.getAttribute('aria-label') ?? '';
        return { visibleLabel, accessibleName };
      })
      .filter(
        ({ visibleLabel, accessibleName }) =>
          visibleLabel && !accessibleName.includes(visibleLabel),
      ),
  );
  check(
    '모든 미디어 버튼의 접근성 이름에 화면에 보이는 라벨이 포함된다',
    labelMismatches.length === 0,
    labelMismatches.length ? JSON.stringify(labelMismatches) : '',
  );
  check(
    '페이지 진입만으로 MP4를 요청하지 않는다',
    !requests.some((url) => url.includes('founding-ceremony.mp4')),
  );

  const rangeResponse = await context.request.get(
    new URL(foundingMedia.find((item) => item.type === 'video').src, BASE).href,
    { headers: { Range: 'bytes=0-1' } },
  );
  check(
    '모바일 영상 재생을 위한 HTTP 구간 요청을 지원한다',
    rangeResponse.status() === 206 &&
      /^bytes 0-1\/\d+$/.test(rangeResponse.headers()['content-range'] ?? ''),
    `status=${rangeResponse.status()} content-range=${rangeResponse.headers()['content-range'] ?? '없음'}`,
  );

  const lead = triggers.first();
  await lead.click();

  const dialog = page.locator('[data-lightbox-root="founding-record"]');
  const stage = dialog.locator('[data-lb-stage]');
  const image = stage.locator('img');
  const count = dialog.locator('[data-lb-count]');
  const manifestText = await page
    .locator('[data-lightbox-manifest="founding-record"]')
    .textContent();
  const manifest = JSON.parse(manifestText ?? '[]');
  check('대표 사진을 누르면 라이트박스가 열린다', await dialog.evaluate((node) => node.open));
  check(
    '최초에는 대표 사진의 화면 맞춤 이미지를 사용한다',
    (await image.getAttribute('src')) === manifest[0]?.src,
  );

  await dialog.locator('[data-lb-next]').click();
  check('다음 버튼은 다음 미디어로 이동한다', (await count.textContent())?.trim() === '2 / 8');
  check(
    '미디어 이동은 새 위치와 캡션을 스크린리더에 알린다',
    (await dialog.locator('[data-lb-live]').textContent())?.includes(
      `2 / 8. ${foundingMedia[1].caption}`,
    ),
  );
  await dialog.locator('[data-lb-prev]').click();
  check('이전 버튼은 앞 미디어로 돌아간다', (await count.textContent())?.trim() === '1 / 8');
  await page.keyboard.press('ArrowLeft');
  check(
    '첫 항목에서 왼쪽 화살표는 마지막 항목으로 순환한다',
    (await count.textContent())?.trim() === '8 / 8',
  );
  await page.keyboard.press('ArrowRight');
  check('오른쪽 화살표는 대표 사진으로 순환한다', (await count.textContent())?.trim() === '1 / 8');

  check(
    '상세 보기 데이터에는 확대·원본 계층이 없다',
    manifest.every((entry) => !('zoom' in entry) && !('original' in entry)),
  );
  check(
    '상세 보기에는 확대·원본 열기 컨트롤이 없다',
    (await dialog.locator('[data-lb-zoom], [data-lb-original]').count()) === 0,
  );

  const transformBeforeClick = await image.evaluate((node) => node.style.transform);
  await image.evaluate((node) =>
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
  );
  check(
    '상세 보기 사진을 다시 눌러도 확대 상태가 생기지 않는다',
    (await stage.evaluate((node) => node.dataset.zoomed === undefined)) &&
      (await image.evaluate((node) => node.style.transform)) === transformBeforeClick,
  );

  await page.keyboard.press('Escape');
  const closedWithEscape = !(await dialog.evaluate((node) => node.open));
  check('Escape는 상세 보기를 닫는다', closedWithEscape);
  if (!closedWithEscape) await dialog.locator('[data-lb-close]').click();
  check(
    '닫으면 원래 갤러리 버튼으로 포커스가 돌아간다',
    await lead.evaluate((node) => document.activeElement === node),
  );

  await triggers.last().click();
  const video = stage.locator('video');
  check('영상 항목은 네이티브 비디오 컨트롤을 사용한다', (await video.count()) === 1);
  check('영상은 자동 재생하지 않는다', await video.evaluate((node) => node.paused));
  check('영상에는 인라인 재생 속성이 있다', await video.evaluate((node) => node.playsInline));

  await dialog.locator('[data-lb-close]').click();
  await context.close();

  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${BASE}/about/founding/`, { waitUntil: 'networkidle' });
  await mobilePage.locator('[data-lightbox-open="founding-record"]').first().click();
  const mobileLayout = await mobilePage.evaluate(() => {
    const root = document.querySelector('[data-lightbox-root="founding-record"]');
    const bar = root?.querySelector('.lb-bar');
    const controls = [...(root?.querySelectorAll('.lb-controls button, .lb-controls a') ?? [])];
    if (!(bar instanceof HTMLElement)) return null;
    const barBox = bar.getBoundingClientRect();
    return {
      barLeft: barBox.left,
      barRight: barBox.right,
      barBottom: barBox.bottom,
      barScrollWidth: bar.scrollWidth,
      barClientWidth: bar.clientWidth,
      controlsInside: controls.every((control) => {
        const box = control.getBoundingClientRect();
        return box.left >= 0 && box.right <= window.innerWidth;
      }),
    };
  });
  check(
    '모바일 라이트박스의 캡션과 컨트롤이 화면 안에 들어온다',
    mobileLayout !== null &&
      mobileLayout.barLeft >= 0 &&
      mobileLayout.barRight <= 390 &&
      mobileLayout.barBottom <= 844 &&
      mobileLayout.barScrollWidth <= mobileLayout.barClientWidth &&
      mobileLayout.controlsInside,
    mobileLayout ? JSON.stringify(mobileLayout) : '하단 바 없음',
  );
  await mobile.close();
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error));
  console.error('❌ 검사 실행 오류:', error);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} founding-media check(s)`);
  process.exit(1);
}

console.log('\nPASS: all founding-media behavior checks');
