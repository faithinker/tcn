// 창립총회 미디어의 상태 전환 회귀 검사.
// 전제: HTTP Range를 지원하는 `astro dev` 또는 `npm run preview:mobile`을
// BASE_URL에 띄워 둔다.
// 사용: BASE_URL=http://localhost:4321 npm run verify:founding-media
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const failures = [];
const foundingMedia = JSON.parse(readFileSync('src/data/founding-media.json', 'utf8'));
const leadRecord = foundingMedia.find((item) => item.type === 'image' && item.role === 'lead');

if (!leadRecord) throw new Error('founding-media.json에 대표 사진이 없다');

function check(label, condition, detail = '') {
  const suffix = detail ? ` — ${detail}` : '';
  if (condition) {
    console.log(`✅ ${label}${suffix}`);
    return;
  }
  failures.push(`${label}${suffix}`);
  console.error(`❌ ${label}${suffix}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
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
    `${BASE}/media/founding/founding-ceremony.mp4`,
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
  check('대표 사진을 누르면 라이트박스가 열린다', await dialog.evaluate((node) => node.open));
  check('최초에는 화면 맞춤 이미지를 사용한다', (await image.getAttribute('data-tier')) === 'fit');

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
  check('첫 항목에서 왼쪽 화살표는 마지막 항목으로 순환한다', (await count.textContent())?.trim() === '8 / 8');
  await page.keyboard.press('ArrowRight');
  check('오른쪽 화살표는 대표 사진으로 순환한다', (await count.textContent())?.trim() === '1 / 8');

  const originalHref = await dialog.locator('[data-lb-original]').getAttribute('href');
  if (!originalHref) throw new Error('원본 링크의 href가 비어 있다');
  const originalResponse = await context.request.get(new URL(originalHref, BASE).href);
  const originalBody = await originalResponse.body();
  const committedMaster = readFileSync(`src/assets/founding/${leadRecord.src}.jpg`);
  check(
    '원본 열기는 재인코딩본이 아니라 커밋된 4000px 마스터를 제공한다',
    originalResponse.ok() && sha256(originalBody) === sha256(committedMaster),
  );

  // astro dev의 4000px AVIF 즉석 변환은 CI CPU에 따라 10초 이상 걸릴 수 있다.
  // 원본 URL의 바이트 무결성은 위에서 별도로 확인했으므로, 상호작용 검사는 같은
  // 4000px 마스터 JPEG를 고해상도 응답으로 사용해 디코드 시간과 무관하게 만든다.
  const leadManifestText = await page
    .locator('[data-lightbox-manifest="founding-record"]')
    .textContent();
  const leadZoomUrl = JSON.parse(leadManifestText ?? '[]')[0]?.zoom;
  if (!leadZoomUrl) throw new Error('대표 사진의 고해상도 URL이 없다');
  await page.route(new URL(leadZoomUrl, BASE).href, (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: committedMaster }),
  );

  // The fitted image can be larger than Playwright's computed viewport while the
  // dialog is open. Trigger the same DOM click handler without a flaky scroll step.
  await image.evaluate((node) =>
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
  );
  check(
    '사진을 누르면 즉시 확대 상태가 된다',
    (await stage.getAttribute('data-zoomed')) === 'true',
  );
  check('확대 사진은 브라우저 기본 끌기를 사용하지 않는다', !(await image.evaluate((node) => node.draggable)));

  // 4000px 마스터 디코드가 끝나면 data-tier가 zoom으로 바뀐다. waitForFunction은
  // 런타임 버전에 따라 기본 timeout이 무제한이라, 이 검사는 명시적인 상한을 둔다.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if ((await image.getAttribute('data-tier')) === 'zoom') break;
    await page.waitForTimeout(250);
  }
  check(
    '확대할 때 4000px 고해상도 계층으로 전환한다',
    (await image.getAttribute('data-tier')) === 'zoom',
  );

  const beforeDrag = await image.evaluate((node) => node.style.transform);
  const stageBox = await stage.boundingBox();
  if (!stageBox) throw new Error('라이트박스 스테이지의 위치를 읽을 수 없다');

  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    stageBox.x + stageBox.width / 2 + 90,
    stageBox.y + stageBox.height / 2 + 55,
    { steps: 5 },
  );
  await page.mouse.up();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );

  const afterDrag = await image.evaluate((node) => node.style.transform);
  check(
    '확대 사진을 드래그해도 확대 상태가 유지된다',
    (await stage.getAttribute('data-zoomed')) === 'true',
  );
  check('드래그하면 사진의 팬 위치가 바뀐다', beforeDrag !== afterDrag);

  await page.keyboard.press('Escape');
  check(
    '확대 상태의 첫 Escape는 사진 맞춤으로 돌아간다',
    (await dialog.evaluate((node) => node.open)) &&
      (await stage.getAttribute('data-zoomed')) === 'false',
  );

  await dialog.locator('[data-lb-zoom]').click();
  check('확대 버튼은 사진을 확대한다', (await stage.getAttribute('data-zoomed')) === 'true');
  await dialog.locator('[data-lb-zoom]').click();
  check('확대 버튼을 다시 누르면 화면 맞춤으로 돌아간다', (await stage.getAttribute('data-zoomed')) === 'false');

  await page.keyboard.press('+');
  const beforeKeyboardPan = await image.evaluate((node) => node.style.transform);
  await page.keyboard.press('ArrowRight');
  const afterKeyboardPan = await image.evaluate((node) => node.style.transform);
  check(
    '확대 상태의 화살표 키는 사진을 이동한다',
    (await stage.getAttribute('data-zoomed')) === 'true' &&
      beforeKeyboardPan !== afterKeyboardPan,
  );
  await page.keyboard.press('0');
  check('0 키는 화면 맞춤으로 돌아간다', (await stage.getAttribute('data-zoomed')) === 'false');

  await page.keyboard.press('Escape');
  check('두 번째 Escape는 라이트박스를 닫는다', !(await dialog.evaluate((node) => node.open)));
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

  const failedZoomContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const failedZoomPage = await failedZoomContext.newPage();
  await failedZoomPage.goto(`${BASE}/about/founding/`, { waitUntil: 'networkidle' });
  const manifestText = await failedZoomPage
    .locator('[data-lightbox-manifest="founding-record"]')
    .textContent();
  const failedZoomUrl = JSON.parse(manifestText ?? '[]')[0]?.zoom;
  if (!failedZoomUrl) throw new Error('대표 사진의 고해상도 URL이 없다');
  await failedZoomPage.route(new URL(failedZoomUrl, BASE).href, (route) => route.abort('failed'));
  await failedZoomPage.locator('[data-lightbox-open="founding-record"]').first().click();
  const failedZoomDialog = failedZoomPage.locator('[data-lightbox-root="founding-record"]');
  const failedZoomStage = failedZoomDialog.locator('[data-lb-stage]');
  const failedZoomImage = failedZoomStage.locator('img');
  await failedZoomImage.evaluate((node) =>
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
  );
  await failedZoomPage.waitForTimeout(300);
  check(
    '고해상도 로딩이 실패하면 화면 맞춤 이미지를 유지한다',
    (await failedZoomImage.getAttribute('data-tier')) === 'fit' &&
      (await failedZoomDialog.locator('[data-lb-loading]').isHidden()),
  );
  await failedZoomContext.close();

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
