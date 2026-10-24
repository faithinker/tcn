// Local-only end-to-end account lifecycle gate; never calls a real email provider.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { deleteAuthEventsSql } from './lib/auth-events.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const base = new URL(process.env.BASE_URL ?? 'http://localhost:4345');
const persist = process.env.TCN_D1_PERSIST_TO ?? '.wrangler/account-preview';
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Local verification only');
const readiness = await fetch(new URL('/api/auth/signup/state', base));
assert.equal(
  readiness.headers.get('x-tcn-local-mail'),
  'true',
  'Start the local Worker with AUTH_MAIL_MODE=local. This gate must not send real email.',
);
const email = `account-gate-${randomUUID()}@example.org`;
const password = `A river ${randomUUID()} flows`;
const newPassword = `A new river ${randomUUID()} flows`;
const resetPassword = `A reset river ${randomUUID()} flows`;
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
        '--persist-to',
        persist,
        '--command',
        command,
        '--json',
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  )[0].results;
}
const mail = (subject) =>
  sql(
    `SELECT body FROM auth_local_mail WHERE recipient=${literal(email)} AND subject=${literal(subject)} ORDER BY rowid DESC LIMIT 1`,
  )[0].body;
const browser = await chromium.launch();
let userId;
const errors = [];
try {
  await mkdir(new URL('../verify/accounts/', import.meta.url), { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(new URL('/signup', base).href);
  await page.locator('#signup-root[data-ready=true]').waitFor();
  await page.locator('#signup-email').fill(email);
  await page.locator('#send-signup-code').click();
  await page.locator('#signup-code-form').waitFor({ state: 'visible' });
  const code = mail('Your TCN email verification code').match(/\b\d{6}\b/)[0];
  await page.locator('#signup-code').fill(code);
  await page.locator('#signup-code-form button[type=submit]').click();
  await page.locator('#signup-form').waitFor({ state: 'visible' });
  assert(await page.locator('#verified-signup-email').isDisabled());
  await page.reload();
  await page.locator('#signup-root[data-ready=true]').waitFor();
  assert(await page.locator('#signup-form').isVisible(), 'Verified signup resumes after reload');
  await page.locator('#signup-name').fill('Lifecycle Researcher');
  await page.locator('#signup-affiliation').fill('Synthetic local institute');
  await page.locator('#signup-password').fill(password);
  await page.locator('#signup-password-confirmation').fill(password);
  await page.locator('#signup-form button[type=submit]').click();
  await page.waitForURL('**/account');
  await page.locator('#account-root[data-ready=true]').waitFor();
  userId = sql(`SELECT id FROM users WHERE username=${literal(email)}`)[0].id;
  assert.match(await page.locator('main').innerText(), /Associate member/);
  const csrf = await page.locator('#account-root').getAttribute('data-csrf');
  assert.equal(
    (
      await context.request.patch(new URL('/api/account/profile', base).href, {
        headers: { origin: base.origin, 'x-csrf-token': csrf },
        data: { displayName: 'Injected', email: 'other@example.org' },
      })
    ).status(),
    400,
  );
  await page.locator('#profile-edit').click();
  await page.locator('#profile-name').fill('Edited Researcher');
  await page.locator('#profile-affiliation').fill('');
  assert((await page.locator('#profile-email').getAttribute('readonly')) !== null);
  await page.locator('#profile-form button[type=submit]').click();
  await page.locator('#profile-saved').waitFor({ state: 'visible' });
  assert.equal(sql(`SELECT revision FROM users WHERE id=${literal(userId)}`)[0].revision, 1);
  await page.screenshot({ path: `${root}verify/accounts/profile-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${root}verify/accounts/profile-mobile.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.setViewportSize({ width: 1280, height: 900 });
  const stale = await browser.newContext();
  await stale.request.post(new URL('/api/auth/login', base).href, {
    headers: { origin: base.origin },
    data: { username: email, password },
  });
  await page.locator('#password-details summary').click();
  await page.locator('#current-password').fill(password);
  await page.locator('#new-password').fill(newPassword);
  await page.locator('#password-confirmation').fill(newPassword);
  await page.locator('[data-account-password] button[type=submit]').click();
  await page.waitForURL('**/login*');
  await page.locator('#login-form[data-ready=true]').waitFor();
  assert.equal(
    (await (await stale.request.get(new URL('/api/auth/me', base).href)).json()).authenticated,
    false,
  );
  assert.match(await page.locator('#login-notice').innerText(), /password has been updated/);
  assert(!new URL(page.url()).searchParams.has('notice'));
  await stale.close();
  await page.goto(new URL('/forgot-password', base).href);
  await page.locator('#recovery-form[data-ready=true]').waitFor();
  await page.locator('#recovery-email').fill(email);
  await page.locator('#recovery-form button[type=submit]').click();
  await page.locator('#recovery-success').waitFor({ state: 'visible' });
  const link = mail('Reset your TCN password').match(/http[^\s]+/)[0];
  await page.goto(link);
  await page.locator('#recovery-form[data-ready=true]').waitFor();
  assert(!new URL(page.url()).searchParams.has('token'));
  await page.locator('#reset-password').fill(resetPassword);
  await page.locator('#reset-password-confirmation').fill(resetPassword);
  await page.locator('#recovery-form button[type=submit]').click();
  await page.waitForURL('**/login*');
  await page.locator('#login-form[data-ready=true]').waitFor();
  await page.locator('#login-username').fill(email);
  await page.locator('#login-password').fill(resetPassword);
  await page.locator('#login-form button[type=submit]').click();
  await page.waitForURL('**/forum/assembly');
  await page.goto(new URL('/account', base).href);
  await page.locator('#account-root[data-ready=true]').waitFor();
  const other = await context.newPage();
  await other.goto(new URL('/account', base).href);
  await other.locator('#account-root[data-ready=true]').waitFor();
  await other.locator('#profile-edit').click();
  await other.locator('#profile-name').fill('Unsaved draft name');
  let withdrawalRequests = 0;
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/account/withdraw') withdrawalRequests++;
  });
  await page.locator('#open-withdrawal').click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'cancel-withdrawal');
  await page.locator('#cancel-withdrawal').click();
  assert.equal(withdrawalRequests, 0);
  await page.locator('#open-withdrawal').click();
  await page.keyboard.press('Escape');
  assert.equal(withdrawalRequests, 0);
  await page.locator('#open-withdrawal').click();
  await page.locator('#withdraw-password').fill('wrong password');
  await page.locator('#withdrawal-form input[name=confirmation]').check();
  await page.locator('#withdrawal-form button[type=submit]').click();
  await page.locator('#withdrawal-form [data-form-error]').waitFor({ state: 'visible' });
  assert(
    await page.locator('#withdrawal-dialog').isVisible(),
    'Wrong password keeps confirmation open',
  );
  await page.locator('#withdraw-password').fill(resetPassword);
  await page.screenshot({ path: `${root}verify/accounts/withdrawal-dialog.png` });
  await page.locator('#withdrawal-form button[type=submit]').click();
  await page.waitForURL('**/account/withdrawn');
  await other.locator('[data-session-ended]').waitFor();
  assert.equal(await other.locator('#profile-name').inputValue(), 'Unsaved draft name');
  assert(await other.locator('#profile-form button[type=submit]').isDisabled());
  assert.equal(
    (await (await context.request.get(new URL('/api/auth/me', base).href)).json()).authenticated,
    false,
  );
  assert(
    !(await context.cookies()).some((c) =>
      ['tcn_session', 'tcn_device', 'tcn_signup'].includes(c.name),
    ),
  );
  const closed = sql(
    `SELECT username,display_name,affiliation,password_hash,deleted_at FROM users WHERE id=${literal(userId)}`,
  )[0];
  assert.equal(closed.username, `withdrawn:${userId}`);
  assert.equal(closed.display_name, null);
  assert.equal(closed.affiliation, null);
  assert.equal(closed.password_hash, '!');
  assert(closed.deleted_at);
  assert.deepEqual(errors, []);
  console.log(
    'PASS account browser lifecycle: verified signup/resume, immutable email, profile editing, password change/reset, withdrawal cancel/ESC/wrong password/success, cookies and cross-tab draft preservation',
  );
  console.log('Screenshots: verify/accounts/');
} finally {
  await browser.close();
  if (userId) {
    const id = literal(userId);
    sql(
      `${deleteAuthEventsSql(id)} DELETE FROM account_events WHERE user_id=${id}; DELETE FROM account_reauth_failures WHERE user_id=${id}; DELETE FROM auth_email_challenges WHERE user_id=${id} OR email=${literal(email)}; DELETE FROM users WHERE id=${id};`,
    );
  }
  sql(
    `DELETE FROM auth_local_mail WHERE recipient=${literal(email)}; DELETE FROM auth_email_challenges WHERE email=${literal(email)};`,
  );
}
