import assert from 'node:assert/strict';
import { openMemberD1Harness } from './lib/member-d1-harness.mjs';
const h = await openMemberD1Harness('src/test-support/account-worker.ts');
try {
  await h.fetch('https://account.test/setup');
  const r = await h.fetch('https://account.test/password');
  assert.equal(r.status, 200, await r.text());
  const changed = await h.db.prepare("SELECT session_version FROM users WHERE id='probe'").first();
  assert.equal(changed.session_version, 2);
  const stale = await h.fetch('https://account.test/withdraw-stale');
  assert.equal(stale.status, 401, 'a stale session must get 401, not a database error');
  assert.deepEqual(await stale.json(), { error: 'unauthorized' });
  const events = await h.db.prepare('SELECT count(*) AS n FROM account_events').first();
  assert.equal(events.n, 0, 'a refused withdrawal leaves no account event');
  const withdrawal = await h.fetch('https://account.test/withdraw');
  assert.equal(withdrawal.status, 200, await withdrawal.text());
  const closed = await h.db
    .prepare(
      "SELECT username,display_name,password_hash,deleted_at,session_version FROM users WHERE id='probe'",
    )
    .first();
  assert.equal(closed.username, 'withdrawn:probe');
  assert.equal(closed.password_hash, '!');
  assert.equal(closed.session_version, 3);
  assert(closed.deleted_at);
  console.log(
    'PASS workerd D1: triggered password change and atomic withdrawal return success, a stale withdrawal answers 401; old credentials removed',
  );
} finally {
  await h.dispose();
}
