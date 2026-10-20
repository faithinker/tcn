import assert from 'node:assert/strict';

export async function verifyMemberFormFallbacks(browser, base, storageState) {
  const cases = [
    [
      '/login',
      '#login-form',
      { username: 'nonexistent-harness-user', password: 'Harness-secret-2026!' },
    ],
    ['/signup', '#signup-email-form', { email: 'fallback@example.org' }],
    ...(storageState
      ? [
          [
            '/forum/directors/new',
            '[data-forum-form]',
            { title: 'Private fallback record', body: 'Must never appear in a URL' },
          ],
        ]
      : []),
  ];
  for (const [path, selector, values] of cases) {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      ...(path.startsWith('/forum') ? { storageState } : {}),
    });
    try {
      const page = await context.newPage();
      await page.goto(new URL(path, base).href);
      for (const [name, value] of Object.entries(values))
        await page.locator(`${selector} [name="${name}"]`).fill(value);
      const navigation = page.waitForRequest((request) => request.isNavigationRequest());
      await page.locator(`${selector} button[type=submit]`).click();
      const request = await navigation;
      assert.equal(
        request.method(),
        'POST',
        `${path}: no-JavaScript form must not put private fields in the URL`,
      );
      assert.equal(new URL(request.url()).search, '', `${path}: no query fields`);
      console.log(`PASS private POST fallback without JavaScript: ${path}`);
    } finally {
      await context.close();
    }
  }
}
