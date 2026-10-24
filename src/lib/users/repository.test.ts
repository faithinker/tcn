import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { mutateUser, listManagedUsers, countPendingUsers, getManagedUser } from './repository';

let harness: TestD1;
let db: D1Database;
const execute = (sql: string) => db.prepare(sql).run();
beforeEach(async () => {
  harness = await openTestD1();
  db = harness.db;
  await execute(
    `INSERT INTO users(id,username,password_hash,role,status,is_executive) VALUES ('actor','actor','hash','officer','approved',1), ('target','target','hash','member','pending',0), ('other','other','hash','officer','approved',1)`,
  );
});
afterEach(async () => harness.dispose());
const input = (requestId = 'request-0001') => ({
  actorId: 'actor',
  targetId: 'target',
  kind: 'status' as const,
  value: { status: 'approved' },
  expectedRevision: 1,
  requestId,
});
const row = () => db.prepare('select * from users where id=?').bind('target').first();
const events = async () => (await db.prepare('select * from user_audit_events').all()).results;
describe('atomic audited user changes on real SQLite', () => {
  it('increments revision and stores exact before/after status snapshots', async () => {
    await mutateUser(db, input());
    expect(await row()).toMatchObject({ status: 'approved', revision: 2, decided_by: 'actor' });
    expect(await events()).toHaveLength(1);
    expect((await events())[0]).toMatchObject({
      action: 'approved',
      before_status: 'pending',
      after_status: 'approved',
      before_revision: 1,
      after_revision: 2,
    });
  });
  it('stores the actor IP with the audit event, and NULL when none is known', async () => {
    await mutateUser(db, { ...input(), ip: '203.0.113.7' });
    await execute("insert into users(id,username,password_hash) values ('second','second','hash')");
    await mutateUser(db, { ...input('request-0002'), targetId: 'second' });
    expect(
      (await db.prepare('select target_id,ip from user_audit_events order by target_id').all())
        .results,
    ).toEqual([
      { target_id: 'second', ip: null },
      { target_id: 'target', ip: '203.0.113.7' },
    ]);
  });
  it('replays only identical requests and checks current actor authority', async () => {
    const result = await mutateUser(db, input());
    expect(await mutateUser(db, input())).toEqual(result);
    expect(await events()).toHaveLength(1);
    await expect(
      mutateUser(db, { ...input(), value: { status: 'rejected' } }),
    ).rejects.toMatchObject({ status: 409 });
    await execute("update users set is_executive=0 where id='actor'");
    await expect(mutateUser(db, input())).rejects.toMatchObject({ status: 403 });
  });
  it('allows exactly one concurrent request at the same revision', async () => {
    const results = await Promise.allSettled([
      mutateUser(db, input()),
      mutateUser(db, input('request-0002')),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await events()).toHaveLength(1);
    expect(await row()).toMatchObject({ revision: 2 });
  });
  it('rolls back the user update if audit insert fails', async () => {
    await execute(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON user_audit_events BEGIN SELECT RAISE(ABORT,'forced audit failure'); END",
    );
    await expect(mutateUser(db, input())).rejects.toThrow();
    expect(await row()).toMatchObject({ status: 'pending', revision: 1 });
    expect(await events()).toHaveLength(0);
  });
  it('the real audit snapshot trigger rejects a fabricated after state and rolls back the update', async () => {
    const originalPrepare = db.prepare.bind(db);
    db.prepare = ((sql: string) => {
      const query = originalPrepare(sql);
      if (!sql.startsWith('INSERT INTO user_audit_events')) return query;
      return {
        bind: (...params: unknown[]) => {
          params[5] = 'rejected';
          return query.bind(...params);
        },
      } as D1PreparedStatement;
    }) as typeof db.prepare;
    await expect(mutateUser(db, input())).rejects.toThrow('user_audit_snapshot_mismatch');
    expect(await row()).toMatchObject({ status: 'pending', revision: 1 });
    expect(await events()).toHaveLength(0);
  });
  it('rejects a zero-row update and never inserts an orphan audit', async () => {
    const originalBatch = db.batch.bind(db);
    db.batch = (async (queries: D1PreparedStatement[]) => {
      await execute("update users set revision=2 where id='target'");
      return originalBatch(queries);
    }) as typeof db.batch;
    await expect(mutateUser(db, input())).rejects.toMatchObject({ status: 409 });
    expect(await row()).toMatchObject({ status: 'pending', revision: 2 });
    expect(await events()).toHaveLength(0);
  });
  it('rechecks actor demotion and target promotion at the write boundary', async () => {
    const originalBatch = db.batch.bind(db);
    db.batch = (async (queries: D1PreparedStatement[]) => {
      await execute("update users set is_executive=0 where id='actor'");
      return originalBatch(queries);
    }) as typeof db.batch;
    await expect(mutateUser(db, input())).rejects.toMatchObject({ status: 403 });
    expect(await events()).toHaveLength(0);
    await execute("update users set is_executive=1 where id='actor'");
    db.batch = (async (queries: D1PreparedStatement[]) => {
      await execute("update users set is_executive=1 where id='target'");
      return originalBatch(queries);
    }) as typeof db.batch;
    await expect(mutateUser(db, input())).rejects.toMatchObject({ status: 403 });
    expect(await row()).toMatchObject({ status: 'pending', revision: 1, is_executive: 1 });
  });
  it('protects newly promoted executives and preserves status decision metadata for permissions', async () => {
    await mutateUser(db, input());
    await mutateUser(db, {
      ...input('promote-0001'),
      kind: 'permissions',
      expectedRevision: 2,
      value: { role: 'officer', isExecutive: true, canAccessDirectorsForum: false },
    });
    expect(await row()).toMatchObject({ revision: 3, is_executive: 1, decided_by: 'actor' });
    await expect(
      mutateUser(db, {
        ...input('revoke-0001'),
        kind: 'permissions',
        expectedRevision: 3,
        value: { role: 'member', isExecutive: false, canAccessDirectorsForum: false },
      }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('lists twenty users with pending oldest first and counts all statuses', async () => {
    for (let i = 0; i < 24; i++)
      await db
        .prepare('insert into users(id,username,password_hash,created_at) values(?,?,?,?)')
        .bind(`p${i}`, `p${i}`, 'hash', i)
        .run();
    const page = await listManagedUsers(db, { status: 'pending', page: 1 });
    expect(page.items).toHaveLength(20);
    expect(page.total).toBe(25);
    expect(page.totalPages).toBe(2);
    expect(page.items[0].id).toBe('p0');
    expect(JSON.stringify(page)).not.toContain('passwordHash');
  });
  it('clamps pages, orders decisions deterministically and never returns credential fields', async () => {
    expect(await countPendingUsers(db)).toBe(1);
    expect(await getManagedUser(db, 'absent')).toBeNull();
    const user = await getManagedUser(db, 'target');
    expect(user).not.toHaveProperty('passwordHash');
    expect(user?.isExecutive).toBe(false);
    await mutateUser(db, input());
    expect(await countPendingUsers(db)).toBe(0);
    const page = await listManagedUsers(db, { status: 'approved', page: 99 });
    expect(page.page).toBe(1);
    expect(page.items[0].id).toBe('target');
    await expect(listManagedUsers(db, { status: 'unknown', page: 1 })).rejects.toMatchObject({
      status: 400,
    });
    await expect(listManagedUsers(db, { status: 'pending', page: 0 })).rejects.toMatchObject({
      status: 400,
    });
  });
});
