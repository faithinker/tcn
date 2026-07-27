import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const failures = [];

function check(label, condition) {
  if (condition) {
    console.log(`✅ ${label}`);
    return;
  }
  failures.push(label);
  console.error(`❌ ${label}`);
}

const browser = await chromium.launch();

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const image = readFileSync('src/assets/founding/founding-video-poster.jpg');
  await page.route('**/media/ci/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/jpeg', body: image }),
  );
  await page.goto(`${BASE}/seminars/2099-12-31`, { waitUntil: 'networkidle' });

  const triggers = page.locator('[data-lightbox-open^="seminar-"]');
  const triggerCount = await triggers.count();
  check('세미나 대표 사진과 갤러리 사진이 같은 캐러셀에 연결된다', triggerCount === 2);

  if (triggerCount === 2) {
    const seminarLabel = (await page.locator('main h1').first().textContent())?.trim();
    const viewerId = await triggers.first().getAttribute('data-lightbox-open');
    if (!viewerId) throw new Error('세미나 캐러셀 id가 없다');
    if (!seminarLabel) throw new Error('세미나 제목을 찾을 수 없다');
    const dialog = page.locator(`[data-lightbox-root="${viewerId}"]`);
    const count = dialog.locator('[data-lb-count]');

    check(
      '보이는 View 라벨이 대표 사진 버튼의 접근성 이름에 포함된다',
      (await triggers.first().getAttribute('aria-label'))?.startsWith('View: ') === true,
    );
    await triggers.first().click();
    check('대표 사진을 누르면 세미나 상세 보기가 열린다', await dialog.evaluate((node) => node.open));
    check('대표 사진이 첫 번째 항목이다', (await count.textContent())?.trim() === '1 / 2');
    check(
      '세미나 상세 보기에도 확대 컨트롤이 없다',
      (await dialog.locator('[data-lb-zoom], [data-lb-original]').count()) === 0,
    );

    await dialog.locator('[data-lb-next]').click();
    check('다음 버튼은 갤러리 사진으로 이동한다', (await count.textContent())?.trim() === '2 / 2');
    check(
      '캡션이 없는 사진은 세미나 순번 기반 설명을 사용한다',
      (await dialog.locator('[data-lb-caption]').textContent())?.trim() ===
        `Photo 2 from the ${seminarLabel}.`,
    );
    check(
      '사진 이동을 스크린리더 라이브 영역에 알린다',
      (await dialog.locator('[data-lb-live]').textContent())?.includes(
        `2 / 2. Photo 2 from the ${seminarLabel}.`,
      ) === true,
    );

    await page.keyboard.press('ArrowRight');
    check('마지막 사진에서 오른쪽 화살표는 대표 사진으로 순환한다', (await count.textContent())?.trim() === '1 / 2');
    await page.keyboard.press('Escape');
    check('Escape는 세미나 상세 보기를 닫는다', !(await dialog.evaluate((node) => node.open)));
    check(
      '닫으면 대표 사진으로 포커스가 돌아간다',
      await triggers.first().evaluate((node) => document.activeElement === node),
    );
  }

  await context.close();
} catch (error) {
  failures.push(`검사 실행 오류: ${String(error)}`);
  console.error(error);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\nFAIL: ${failures.length} seminar-carousel check(s)`);
  process.exit(1);
}

console.log('\nPASS: all seminar-carousel behavior checks');
