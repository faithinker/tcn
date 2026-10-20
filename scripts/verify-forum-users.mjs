// Local-only browser harness. Temporary accounts are removed after verification.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { verifyMemberFormFallbacks } from './lib/member-form-fallbacks.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL(process.env.BASE_URL || 'http://localhost:4321');
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname),
  'Member harness may only run against localhost',
);
const prefix = `member-gate-${randomUUID()}`;
const password = `Harness-${randomUUID()}-A9`;
const salt = randomBytes(16);
const passwordHash = `pbkdf2$50000$${salt.toString('base64')}$${pbkdf2Sync(password, salt, 50000, 32, 'sha256').toString('base64')}`;
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
function sql(command) {
  return JSON.parse(
    execFileSync(
      `${root}node_modules/.bin/wrangler`,
      [
        'd1',
        'execute',
        'tcn-content',
        '--local',
        ...(process.env.TCN_D1_PERSIST_TO ? ['--persist-to', process.env.TCN_D1_PERSIST_TO] : []),
        '--command',
        command,
        '--json',
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
}
const definitions = [
  ['pending', 'member', 'pending', 0, 0],
  ['rejected', 'member', 'rejected', 0, 0],
  ['member', 'member', 'approved', 0, 0],
  ['advisor', 'member', 'approved', 0, 1],
  ['director', 'officer', 'approved', 0, 0],
  ['president', 'officer', 'approved', 1, 0],
  ['vice', 'officer', 'approved', 1, 0],
];
const names = definitions.map(([name]) => `${prefix}-${name}`);
const signupName = `${prefix}-signup@example.org`;
const ownedUsers = [...names, signupName].map(literal).join(',');
let browser;
const contexts = new Map();
const errors = [];
try {
  const state = await (await fetch(new URL('/api/auth/me', base))).json();
  assert.equal(
    state.memberFeaturesEnabled,
    true,
    'Enable MEMBER_FEATURES_ENABLED=true in local .dev.vars first',
  );
  for (const [name, role, status, executive, special] of definitions) {
    const id = `${prefix}-${name}`;
    sql(
      `insert into users(id,username,password_hash,display_name,role,status,is_executive,can_access_directors_forum) values (${literal(id)},${literal(id)},${literal(passwordHash)},${literal(`Harness ${name}`)},${literal(role)},${literal(status)},${executive},${special})`,
    );
  }
  browser = await chromium.launch();
  await mkdir(new URL('../verify/members/', import.meta.url), { recursive: true });
  for (const [name] of definitions) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    context.on('page', (page) => {
      page.on('response', (response) => {
        if (new URL(response.url()).pathname.startsWith('/_astro/') && response.status() >= 400)
          errors.push(`Asset failed: ${response.status()} ${response.url()}`);
      });
    });
    contexts.set(name, context);
    const response = await context.request.post(new URL('/api/auth/login', base).href, {
      data: { username: `${prefix}-${name}`, password },
    });
    assert.equal(response.status(), 200, `${name}: login; local LOGIN_CHALLENGE=off required`);
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
    const allowedAssembly = name !== 'rejected';
    const allowedDirectors = ['advisor', 'director', 'president', 'vice'].includes(name);
    const manager = ['president', 'vice'].includes(name);
    for (const [path, allowed] of [
      ['/forum/assembly', allowedAssembly],
      ['/forum/directors', allowedDirectors],
      ['/admin/users', manager],
    ]) {
      const result = await page.goto(new URL(path, base).href);
      assert.equal(result.status(), allowed ? 200 : 403, `${name}: ${path}`);
      assert.equal(result.headers()['cache-control'], 'no-store');
      assert.equal(result.headers()['x-robots-tag'], 'noindex');
      if (allowed) {
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
          true,
          `${name}: horizontal overflow`,
        );
      }
    }
    await page.goto(new URL('/account', base).href);
    await page.waitForFunction(
      () => document.documentElement.dataset.memberNavigationReady === 'true',
    );
    await page.locator('[data-board-menu] summary').hover();
    assert.deepEqual(
      await page
        .locator('[data-board-menu] a:visible')
        .evaluateAll((links) => links.map((link) => new URL(link.href).pathname)),
      [
        ...(allowedDirectors ? ['/forum/directors'] : []),
        ...(allowedAssembly ? ['/forum/assembly'] : []),
        '/questions',
      ],
      `${name}: actual authenticated board menu visibility`,
    );
    await page.locator('main').hover({ position: { x: 5, y: 100 } });
    await page.screenshot({ path: `${root}verify/members/${name}-account.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(new URL(allowedDirectors ? '/forum/directors' : '/account', base).href);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      true,
      `${name}: mobile overflow`,
    );
    await page.screenshot({ path: `${root}verify/members/${name}-mobile.png`, fullPage: true });
    console.log(`PASS browser permissions: ${name}`);
  }
  // Exercise the actual post form, not only repository or route calls.
  const author = contexts.get('advisor');
  const editor = await author.newPage();
  await editor.goto(new URL('/forum/directors/new', base).href);
  await editor.locator('#forum-title').fill('Harness internal record');
  await editor
    .locator('#forum-body')
    .fill('<script>window.memberHarnessXss=true</script>\nPlain text only.');
  await Promise.all([
    editor.waitForURL((url) => /^\/forum\/directors\/[0-9a-f-]{36}$/.test(url.pathname)),
    editor.locator('[data-forum-form] button[type=submit]').click(),
  ]);
  const postUrl = new URL(editor.url());
  assert.equal(await editor.evaluate(() => window.memberHarnessXss), undefined);
  const csrf = await editor.locator('[data-csrf]').first().getAttribute('data-csrf');
  assert(csrf, 'Detailed post must expose scoped CSRF to its authorized controls');
  const other = contexts.get('director');
  await other.request.get(new URL('/forum/directors/new', base).href);
  const otherPage = await other.newPage();
  await otherPage.goto(new URL('/forum/directors/new', base).href);
  const otherCsrf = await otherPage.locator('[data-csrf]').first().getAttribute('data-csrf');
  const id = postUrl.pathname.split('/').at(-1);
  const forbidden = await other.request.put(new URL(`/api/forum/directors/${id}`, base).href, {
    headers: { origin: base.origin, 'x-csrf-token': otherCsrf },
    data: { title: 'Tampered', body: 'Not mine', expectedRevision: 1 },
  });
  assert.equal(
    forbidden.status(),
    403,
    `Another officer cannot edit an advisor post (${postUrl.href}): ${await forbidden.text()}`,
  );
  editor.on('dialog', (dialog) => dialog.accept());
  await Promise.all([
    editor.waitForURL(/\/forum\/directors$/),
    editor.locator('[data-forum-hide] button').click(),
  ]);
  assert.equal((await author.request.get(postUrl.href)).status(), 404);
  console.log('PASS browser post create, escaped content, ownership and hide');

  const president = contexts.get('president');
  const managerPage = await president.newPage();
  managerPage.on('dialog', (dialog) => dialog.accept());
  await managerPage.goto(new URL('/admin/users?status=pending', base).href);
  const pendingRow = managerPage.locator(`[data-user-id="${prefix}-pending"]`);
  const approvedResponse = managerPage.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.url().endsWith('/status'),
  );
  await pendingRow.locator('[data-user-status="approved"]').click();
  assert.equal((await approvedResponse).status(), 200, 'Executive approval via actual UI');
  assert.equal(
    (await (await contexts.get('pending').request.get(new URL('/api/auth/me', base).href)).json())
      .user.status,
    'approved',
  );
  await managerPage.goto(new URL('/admin/users?status=approved', base).href);
  for (const name of ['president', 'vice']) {
    const protectedRow = managerPage.locator(`[data-user-id="${prefix}-${name}"]`);
    assert.equal(
      await protectedRow.locator('button, input, select').count(),
      0,
      `${name}: read-only UI`,
    );
  }
  const userCsrf = await managerPage.locator('[data-users-admin]').getAttribute('data-csrf-token');
  for (const name of ['president', 'vice']) {
    for (const [kind, data] of [
      ['status', { status: 'rejected' }],
      ['permissions', { role: 'member', isExecutive: false, canAccessDirectorsForum: false }],
    ]) {
      const response = await president.request.patch(
        new URL(`/api/users/${prefix}-${name}/${kind}`, base).href,
        {
          headers: { origin: base.origin, 'x-csrf-token': userCsrf },
          data: { ...data, expectedRevision: 1, requestId: randomUUID() },
        },
      );
      assert.equal(response.status(), 403, `${name}: protected ${kind} API`);
    }
  }
  const memberRow = managerPage.locator(`[data-user-id="${prefix}-member"]`);
  await memberRow.locator('[name="canAccessDirectorsForum"]').check();
  const changedResponse = managerPage.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && response.url().endsWith('/permissions'),
  );
  await memberRow.getByRole('button', { name: 'Save permissions' }).click();
  assert.equal((await changedResponse).status(), 200, 'Special access via actual UI');
  const changed = await (
    await contexts.get('member').request.get(new URL('/api/auth/me', base).href)
  ).json();
  assert.equal(changed.capabilities.directorsForum, true);
  assert.equal(changed.capabilities.manageContent, false);
  assert.equal(changed.capabilities.manageUsers, false);
  await managerPage.setViewportSize({ width: 390, height: 844 });
  await managerPage.goto(new URL('/admin/users?status=approved', base).href);
  assert.equal(
    await managerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    true,
    'Users mobile page overflow',
  );
  await managerPage.screenshot({ path: `${root}verify/members/users-mobile.png`, fullPage: true });
  console.log('PASS browser approval, special access change, executive mutual/self protection');

  const anonymous = await browser.newContext();
  const page = await anonymous.newPage();
  const login = await page.goto(new URL('/forum/assembly', base).href);
  assert.equal(login.status(), 200);
  assert.equal(new URL(page.url()).pathname, '/login');
  // Signup is optional at runtime; exercise it when enabled in this local test configuration.
  const startSignup = await anonymous.request.post(new URL('/api/auth/signup/start', base).href, {
    headers: { origin: base.origin },
    data: { email: signupName },
  });
  if (startSignup.status() !== 404) {
    assert.equal(
      startSignup.status(),
      200,
      `Signup start failed (use AUTH_MAIL_MODE=local): ${await startSignup.text()}`,
    );
    const mail = sql(
      `SELECT body FROM auth_local_mail WHERE recipient=${literal(signupName)} ORDER BY rowid DESC LIMIT 1`,
    )[0].results[0];
    assert(
      mail,
      'This local-only gate requires AUTH_MAIL_MODE=local; it must never send a real email',
    );
    const code = mail.body.match(/\b\d{6}\b/)[0];
    const verified = await anonymous.request.post(new URL('/api/auth/signup/verify', base).href, {
      headers: { origin: base.origin },
      data: { code },
    });
    assert.equal(verified.status(), 200, await verified.text());
    const signup = await anonymous.request.post(new URL('/api/auth/signup', base).href, {
      headers: { origin: base.origin },
      data: {
        email: signupName,
        password,
        passwordConfirmation: password,
        displayName: 'Harness applicant',
        affiliation: 'Local verification',
      },
    });
    assert.equal(signup.status(), 201, await signup.text());
    const me = await (await anonymous.request.get(new URL('/api/auth/me', base).href)).json();
    assert.equal(me.user.status, 'pending');
    assert.equal(me.capabilities.directorsForum, false);
    assert.equal(me.capabilities.assemblyForum, true);
    console.log('PASS verified-email signup default pending and minimal access');
  } else console.log('SKIP signup: local SIGNUP_ENABLED is off');
  await anonymous.close();
  await verifyMemberFormFallbacks(browser, base, await author.storageState());
  if (process.env.MEMBER_A11Y === '1') {
    const chrome = await launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ['--headless=new', '--no-sandbox'],
    });
    try {
      for (const [role, path] of [
        ['advisor', '/forum/directors/new'],
        ['member', '/account'],
        ['president', '/admin/users?status=approved'],
      ]) {
        const cookies = (await contexts.get(role).cookies())
          .map(({ name, value }) => `${name}=${value}`)
          .join('; ');
        const { lhr } = await lighthouse(new URL(path, base).href, {
          port: chrome.port,
          onlyCategories: ['accessibility'],
          output: 'json',
          logLevel: 'error',
          extraHeaders: { Cookie: cookies },
          disableStorageReset: true,
        });
        const score = Math.round(lhr.categories.accessibility.score * 100);
        assert.equal(
          new URL(lhr.finalDisplayedUrl).pathname,
          new URL(path, base).pathname,
          `${role}: accessibility check must remain on the authenticated page`,
        );
        const failed = lhr.categories.accessibility.auditRefs
          .map(({ id }) => lhr.audits[id])
          .filter((a) => a.score !== null && a.score < 1)
          .map((a) => a.id);
        console.log(
          `Member a11y ${role} ${path}: ${score}; findings: ${failed.join(', ') || 'none'}`,
        );
        assert(score >= 90, `${role} ${path}: accessibility below 90`);
      }
    } finally {
      chrome.kill();
    }
  }
  const logoutContext = contexts.get('vice');
  const logoutPage = await logoutContext.newPage();
  await logoutPage.goto(new URL('/account', base).href);
  await logoutPage.locator('[data-header-profile]').waitFor({ state: 'visible' });
  await logoutPage.locator('[data-header-profile]').click();
  assert.equal(new URL(logoutPage.url()).pathname, '/account');
  await logoutPage.locator('[data-header-logout]').click();
  await logoutPage.locator('[data-header-sign-in]').waitFor({ state: 'visible' });
  assert.equal(new URL(logoutPage.url()).pathname, '/');
  const loggedOut = await (
    await logoutContext.request.get(new URL('/api/auth/me', base).href)
  ).json();
  assert.equal(loggedOut.authenticated, false, 'Header logout must clear the real session');
  console.log('PASS actual header profile link and session logout');
  assert.deepEqual(errors, []);
  console.log('PASS: member browser harness; screenshots in verify/members/');
} finally {
  if (browser) await browser.close();
  // Exact generated usernames scope cleanup to fixtures from this invocation.
  sql(
    `delete from auth_local_mail where recipient in (${ownedUsers}); delete from auth_email_challenges where email in (${ownedUsers}); delete from account_reauth_failures where user_id in (select id from users where username in (${ownedUsers})); delete from account_events where user_id in (select id from users where username in (${ownedUsers})); delete from user_audit_events where target_id in (select id from users where username in (${ownedUsers})) or actor_id in (select id from users where username in (${ownedUsers})); delete from forum_posts where author_id in (select id from users where username in (${ownedUsers})); delete from users where username in (${ownedUsers});`,
  );
}
