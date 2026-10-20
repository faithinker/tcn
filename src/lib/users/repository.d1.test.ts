import { afterAll, beforeAll, expect, it } from 'vitest';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFileSync, readdirSync } from 'node:fs';
import { mutateUser } from './repository';

let mf: Miniflare;
let db: D1Database;
beforeAll(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: '2026-10-01',
      d1Databases: ['DB'],
    }),
  );
  db = (await mf.getD1Database('DB')) as unknown as D1Database;
  for (const file of readdirSync('migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    const sql = readFileSync(`migrations/${file}`, 'utf8').replace(/--[^\n]*/g, '');
    const triggerStart = sql.indexOf('CREATE TRIGGER');
    const prefix = triggerStart < 0 ? sql : sql.slice(0, triggerStart);
    for (const part of prefix
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await db.prepare(part).run();
    if (triggerStart >= 0) await db.prepare(sql.slice(triggerStart)).run();
  }
  await db
    .prepare(
      `INSERT INTO users(id,username,password_hash,role,status,is_executive) VALUES ('actor','actor','hash','officer','approved',1),('target','target','hash','member','pending',0)`,
    )
    .run();
}, 30000);
afterAll(async () => {
  await mf?.dispose();
});
const input = (requestId: string) => ({
  actorId: 'actor',
  targetId: 'target',
  kind: 'status' as const,
  value: { status: 'approved' },
  expectedRevision: 1,
  requestId,
});
it('real D1 batches permit one racing writer and an identical retry without duplicate audit', async () => {
  const results = await Promise.allSettled([
    mutateUser(db, input('d1-request-0001')),
    mutateUser(db, input('d1-request-0002')),
  ]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  const audit = await db
    .prepare('select request_id from user_audit_events')
    .all<{ request_id: string }>();
  expect(audit.results).toHaveLength(1);
  const result = await mutateUser(db, input(audit.results[0].request_id));
  expect(result.revision).toBe(2);
});
it('real D1 rolls back a conditional zero-row update with no orphan event', async () => {
  await db
    .prepare("INSERT INTO users(id,username,password_hash) VALUES ('zero','zero','hash')")
    .run();
  const original = db.batch.bind(db);
  const racing = {
    prepare: db.prepare.bind(db),
    batch: async (queries: D1PreparedStatement[]) => {
      await db.prepare("update users set revision=2 where id='zero'").run();
      return original(queries);
    },
  } as unknown as D1Database;
  await expect(
    mutateUser(racing, { ...input('d1-zero-0001'), targetId: 'zero' }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await db.prepare("select status,revision from users where id='zero'").first()).toEqual({
    status: 'pending',
    revision: 2,
  });
  expect(
    await db
      .prepare("select count(*) as count from user_audit_events where target_id='zero'")
      .first(),
  ).toEqual({ count: 0 });
});
it('real D1 rolls back a user UPDATE when audit validation fails', async () => {
  await db
    .prepare("INSERT INTO users(id,username,password_hash) VALUES ('rollback','rollback','hash')")
    .run();
  await db
    .prepare(
      "CREATE TRIGGER fail_user_audit BEFORE INSERT ON user_audit_events WHEN NEW.target_id='rollback' BEGIN SELECT RAISE(ABORT,'forced audit error'); END",
    )
    .run();
  await expect(
    mutateUser(db, { ...input('d1-rollback-0001'), targetId: 'rollback' }),
  ).rejects.toThrow('forced audit error');
  expect(await db.prepare("select status,revision from users where id='rollback'").first()).toEqual(
    { status: 'pending', revision: 1 },
  );
  expect(
    await db
      .prepare("select count(*) as count from user_audit_events where target_id='rollback'")
      .first(),
  ).toEqual({ count: 0 });
});
