import assert from 'node:assert/strict';
import { openMemberD1Harness } from './lib/member-d1-harness.mjs';

const harness = await openMemberD1Harness('src/test-support/users-worker.ts');
const { db } = harness;
const execute = (sql) => db.prepare(sql).run();
const row = (id) =>
  db
    .prepare(
      'SELECT status,role,is_executive,can_access_directors_forum,revision,decided_by,decided_at FROM users WHERE id=?',
    )
    .bind(id)
    .first();
const count = async (id) =>
  (
    await db
      .prepare('SELECT count(*) AS count FROM user_audit_events WHERE target_id=?')
      .bind(id)
      .first()
  ).count;
const input = (targetId, requestId, extra = {}) => ({
  actorId: 'actor',
  targetId,
  requestId,
  kind: 'status',
  value: { status: 'approved' },
  expectedRevision: 1,
  ...extra,
});
const change = async (value) => {
  const response = await harness.fetch('http://users.test/mutate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  });
  return { status: response.status, body: await response.json() };
};
try {
  await execute(
    "INSERT INTO users(id,username,password_hash,role,status,is_executive) VALUES ('actor','actor','hash','officer','approved',1),('executive','executive','hash','officer','rejected',1)",
  );
  for (const id of [
    'target',
    'rollback',
    'updatefail',
    'zero',
    'demotion',
    'promotion',
    'permissions',
    'rejected',
  ]) {
    await db
      .prepare('INSERT INTO users(id,username,password_hash) VALUES (?,?,?)')
      .bind(id, id, 'hash')
      .run();
  }
  const racing = await Promise.all([
    change(input('target', 'race-0001')),
    change(input('target', 'race-0002')),
  ]);
  assert.deepEqual(racing.map((r) => r.status).sort(), [200, 409]);
  assert.equal(await count('target'), 1);
  assert.equal((await row('target')).revision, 2);
  const winner = racing.find((r) => r.status === 200).body.user;
  assert.deepEqual((await change(input('target', winner.requestId))).body.user, winner);
  assert.equal(await count('target'), 1);
  assert.equal(
    (await change(input('target', winner.requestId, { value: { status: 'rejected' } }))).status,
    409,
  );
  assert.equal((await change(input('executive', 'protect-0001'))).status, 403);
  assert.equal((await change(input('actor', 'protect-0002'))).status, 403);

  await execute(
    "CREATE TRIGGER forced_audit_failure BEFORE INSERT ON user_audit_events WHEN NEW.target_id='rollback' BEGIN SELECT RAISE(ABORT,'forced audit failure'); END",
  );
  assert.equal((await change(input('rollback', 'rollback-0001'))).status, 500);
  assert.equal((await row('rollback')).revision, 1);
  assert.equal((await row('rollback')).status, 'pending');
  assert.equal(await count('rollback'), 0);
  await execute(
    "CREATE TRIGGER forced_update_failure BEFORE UPDATE ON users WHEN NEW.id='updatefail' BEGIN SELECT RAISE(ABORT,'forced user failure'); END",
  );
  assert.equal((await change(input('updatefail', 'updatefail-0001'))).status, 500);
  assert.equal(await count('updatefail'), 0);
  assert.equal((await row('updatefail')).revision, 1);
  assert.equal((await change(input('zero', 'zero-0001', { boundary: 'revision' }))).status, 409);
  assert.equal((await row('zero')).status, 'pending');
  assert.equal(await count('zero'), 0);
  assert.equal(
    (await change(input('demotion', 'demotion-0001', { boundary: 'demote' }))).status,
    403,
  );
  assert.equal((await row('demotion')).revision, 1);
  assert.equal(await count('demotion'), 0);
  assert.equal((await change(input('target', winner.requestId))).status, 403);
  await execute("UPDATE users SET is_executive=1 WHERE id='actor'");
  assert.equal(
    (await change(input('promotion', 'promotion-0001', { boundary: 'promote' }))).status,
    403,
  );
  assert.equal((await row('promotion')).status, 'pending');
  assert.equal(await count('promotion'), 0);

  assert.equal((await change(input('permissions', 'permissions-0001'))).status, 200);
  const before = await row('permissions');
  assert.equal(
    (
      await change(
        input('permissions', 'permissions-0002', {
          kind: 'permissions',
          expectedRevision: 2,
          value: { role: 'member', isExecutive: false, canAccessDirectorsForum: true },
        }),
      )
    ).status,
    200,
  );
  assert.equal((await row('permissions')).can_access_directors_forum, 1);
  assert.equal((await row('permissions')).decided_at, before.decided_at);
  assert.equal(
    (
      await change(
        input('permissions', 'permissions-0003', {
          kind: 'permissions',
          expectedRevision: 3,
          value: { role: 'officer', isExecutive: true, canAccessDirectorsForum: false },
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await change(
        input('permissions', 'permissions-0004', {
          kind: 'permissions',
          expectedRevision: 4,
          value: { role: 'member', isExecutive: false, canAccessDirectorsForum: false },
        }),
      )
    ).status,
    403,
  );
  assert.equal(
    (await change(input('rejected', 'reject-0001', { value: { status: 'rejected' } }))).status,
    200,
  );
  assert.equal(
    (await change(input('rejected', 'reapprove-0001', { expectedRevision: 2 }))).status,
    200,
  );
  assert.equal(
    (
      await db
        .prepare("SELECT action FROM user_audit_events WHERE request_id='reapprove-0001'")
        .first()
    ).action,
    'reapproved',
  );
  const audits = await db.prepare('SELECT request_fingerprint FROM user_audit_events').all();
  assert.ok(audits.results.every((a) => /^[0-9a-f]{64}$/.test(a.request_fingerprint)));
  console.log(
    'PASS: actual workerd user repository, atomic UPDATE/audit rollback, zero-row conflict, request replay, revision concurrency, actor demotion, target promotion, protected executives and final permission changes',
  );
} finally {
  await harness.dispose();
}
