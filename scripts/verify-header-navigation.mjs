import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.BASE_URL || 'http://localhost:4321';
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  // Synthetic me responses exercise the presentation contract, never bypass server authorization.
  let session = { authenticated: false, memberFeaturesEnabled: true };
  let failLogout = false;
  let logoutRequests = 0;
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: session }));
  await page.route('**/api/auth/logout', (route) => {
    assert.equal(route.request().method(), 'POST');
    logoutRequests++;
    if (failLogout) return route.fulfill({ status: 503, json: { ok: false } });
    session = { authenticated: false, memberFeaturesEnabled: true };
    return route.fulfill({ json: { ok: true } });
  });
  const root = page.locator('[data-board-menu]');
  const trigger = root.locator('summary');
  for (const [label, capabilities, expected, enabled = true] of [
    ['anonymous', null, ['/questions']],
    ['pending/member', { assemblyForum: true }, ['/forum/assembly', '/questions']],
    ['rejected', {}, ['/questions']],
    [
      'advisor/officer/executive',
      { assemblyForum: true, directorsForum: true },
      ['/forum/directors', '/forum/assembly', '/questions'],
    ],
    ['release gate off', { assemblyForum: true, directorsForum: true }, ['/questions'], false],
  ]) {
    session = {
      memberFeaturesEnabled: enabled,
      authenticated: capabilities !== null,
      capabilities: capabilities ?? {},
    };
    await page.goto(base);
    assert.equal(await root.count(), 1, 'Header must replace Q&A with a boards dropdown');
    await page.waitForFunction(
      () => document.documentElement.dataset.memberNavigationReady === 'true',
    );
    assert.equal(
      await page.locator('[data-header-sign-in]').isVisible(),
      capabilities === null,
      `${label}: sign in visibility`,
    );
    assert.equal(
      await page.locator('[data-header-profile]').isVisible(),
      capabilities !== null,
      `${label}: profile icon visibility`,
    );
    assert.equal(
      await page.locator('[data-header-logout]').isVisible(),
      capabilities !== null,
      `${label}: logout visibility`,
    );
    assert.equal(
      await page.locator('header').getByText('Join / Contact', { exact: true }).count(),
      0,
    );
    assert.equal(await page.locator('nav[aria-label="Primary"] > a[href="/contact"]').count(), 0);
    const about = page.locator('nav[aria-label="Primary"] details').filter({ hasText: 'About' });
    await about.locator('summary').click();
    assert.equal(
      await about.getByRole('link', { name: 'Contact', exact: true }).getAttribute('href'),
      '/contact',
    );
    assert.equal(
      await about
        .locator('a')
        .last()
        .textContent()
        .then((text) => text.trim()),
      'Contact',
    );
    assert.equal(
      await page
        .locator('footer')
        .getByRole('link', { name: 'Contact', exact: true })
        .getAttribute('href'),
      '/contact',
    );
    if (label === 'anonymous') await page.screenshot({ path: 'verify/header-contact-about.png' });
    await trigger.hover();
    await page.waitForFunction(() => document.querySelector('[data-board-menu]')?.open === true);
    assert.deepEqual(
      await root
        .locator('a:visible')
        .evaluateAll((links) => links.map((a) => new URL(a.href).pathname)),
      expected,
      label,
    );
    await page.locator('main').hover({ position: { x: 5, y: 100 } });
    await page.waitForFunction(() => !document.querySelector('[data-board-menu]')?.open);
    console.log(`PASS header visibility: ${label}`);
  }
  session = {
    memberFeaturesEnabled: true,
    authenticated: true,
    capabilities: { assemblyForum: true, directorsForum: true },
  };
  await page.reload();
  await page.waitForFunction(
    () => document.documentElement.dataset.memberNavigationReady === 'true',
  );
  await trigger.hover();
  await trigger.click();
  await page.locator('main').hover({ position: { x: 5, y: 100 } });
  assert.equal(await root.getAttribute('open'), '', 'Click pins an already-hovered menu');
  await page.locator('main').click({ position: { x: 5, y: 100 } });
  assert.equal(await root.getAttribute('open'), null, 'Outside click closes a pinned menu');
  await trigger.hover();
  await trigger.click();
  await page.mouse.wheel(0, 100);
  await page.waitForFunction(() => !document.querySelector('[data-board-menu]')?.open);
  // Scroll closure must not immediately reopen while the pointer remains over the trigger.
  assert.equal(await root.getAttribute('open'), null);
  await page.mouse.move(5, 5);
  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-board-menu]')?.open === true);
  await page.keyboard.press('Escape');
  assert.equal(await root.getAttribute('open'), null);
  assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#navToggle').click();
  assert.equal(
    await page
      .locator('#mobileNav a[href="/contact"]')
      .evaluate((link) => link.closest('ul')?.previousElementSibling?.textContent?.trim()),
    'About',
  );
  assert.deepEqual(
    await page
      .locator('#mobileNav [data-board-link]:visible')
      .evaluateAll((links) => links.map((a) => new URL(a.href).pathname)),
    ['/forum/directors', '/forum/assembly', '/questions'],
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
  );
  for (const width of [320, 375, 768, 896, 1024, 1152, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      `Authenticated header overflow at ${width}`,
    );
  }
  assert.equal(await page.locator('[data-header-profile]').getAttribute('href'), '/account');
  assert.equal(
    await page.locator('[data-header-profile]').getAttribute('aria-label'),
    'My profile',
  );
  failLogout = true;
  await page.locator('[data-header-logout]').click();
  await page.locator('[data-header-auth-error]').waitFor({ state: 'visible' });
  assert.equal(
    await page.locator('[data-header-profile]').isVisible(),
    true,
    'Failed logout keeps authenticated controls',
  );
  assert.equal(
    await page.locator('[data-header-logout]').isEnabled(),
    true,
    'Failed logout permits retry',
  );
  failLogout = false;
  await page.locator('[data-header-logout]').click();
  await page.locator('[data-header-sign-in]').waitFor({ state: 'visible' });
  assert.equal(logoutRequests, 2, 'One POST per logout attempt');
  assert.equal(await page.locator('[data-header-profile]').isVisible(), false);
  assert.equal(await page.locator('[data-header-logout]').isVisible(), false);
  for (const width of [320, 375, 768, 896, 1024, 1152, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      `Anonymous header overflow at ${width}`,
    );
  }
  console.log('PASS header hover, click pin, outside click, scroll, keyboard and mobile');
  console.log(
    'PASS header auth controls, Contact under About, footer link and logout failure/retry',
  );
} finally {
  await browser.close();
}
