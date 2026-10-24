import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { mutateUser } from '../users/repository';
import { purgeExpiredLogs } from './log-retention';

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
let harness: TestD1;
let db: D1Database;
const execute = async (sql: string, ...params: unknown[]) =>
  db
    .prepare(sql)
    .bind(...params)
    .run();
const ids = async (table: string) =>
  ((await db.prepare(`select id from ${table} order by id`).all()).results as { id: string }[]).map(
    (row) => row.id,
  );
const accessEvent = (id: string, days: number) =>
  execute(
    `insert into admin_access_events(id,actor_id,action,scope,subject_ids,subject_count,ip,created_at)
     values(?,'exec','users_list_viewed','status=pending;page=1','[]',0,'198.51.100.1',?)`,
    id,
    now() - days * DAY,
  );
const authEvent = (id: string, staff: 0 | 1, days: number) =>
  execute(
    `insert into auth_events(id,user_id,event,staff,ip,created_at) values(?,NULL,'login_failure',?,'198.51.100.1',?)`,
    id,
    staff,
    now() - days * DAY,
  );

const challenge = (id: string, purpose: 'signup' | 'reset', secondsFromNow: number) =>
  execute(
    `insert into auth_email_challenges(id,purpose,email,proof_hash,expires_at,created_at)
     values(?,?,?,?,?,?)`,
    id,
    purpose,
    `${id}@example.org`,
    'proof',
    now() + secondsFromNow,
    now() - 3600,
  );

beforeEach(async () => {
  harness = await openTestD1();
  db = harness.db;
  await execute(
    `insert into users(id,username,password_hash,role,status,is_executive) values
     ('exec','exec','hash','officer','approved',1),
     ('t1','t1','hash','member','pending',0),
     ('t2','t2','hash','member','pending',0)`,
  );
});
afterEach(() => harness.dispose());

describe('purgeExpiredLogs', () => {
  it('deletes each log past its own retention and keeps the rest', async () => {
    await accessEvent('access-old', 396);
    await accessEvent('access-young', 394);
    await authEvent('staff-old', 1, 396);
    await authEvent('staff-young', 1, 394);
    await authEvent('member-old', 0, 91);
    await authEvent('member-young', 0, 89);

    await purgeExpiredLogs(db);

    expect(await ids('admin_access_events')).toEqual(['access-young']);
    expect(await ids('auth_events')).toEqual(['member-young', 'staff-young']);
  });

  it('clears the IP of an expired audit event but keeps the event', async () => {
    const change = (targetId: string, requestId: string, ip: string) =>
      mutateUser(db, {
        actorId: 'exec',
        targetId,
        kind: 'status',
        value: { status: 'approved' },
        expectedRevision: 1,
        requestId,
        ip,
      });
    await change('t1', 'request-1', '203.0.113.1');
    await change('t2', 'request-2', '203.0.113.2');
    await execute(
      "update user_audit_events set created_at=? where target_id='t1'",
      now() - 396 * DAY,
    );

    await purgeExpiredLogs(db);

    expect(
      (await db.prepare('select target_id, ip from user_audit_events order by target_id').all())
        .results,
    ).toEqual([
      { target_id: 't1', ip: null },
      { target_id: 't2', ip: '203.0.113.2' },
    ]);
  });

  it('reports what it removed and does nothing the second time', async () => {
    await accessEvent('access-old', 396);
    await authEvent('member-old', 0, 91);
    await authEvent('staff-old', 1, 396);

    expect(await purgeExpiredLogs(db)).toEqual({
      accessEvents: 1,
      authEvents: 2,
      auditIps: 0,
      emailChallenges: 0,
    });
    expect(await purgeExpiredLogs(db)).toEqual({
      accessEvents: 0,
      authEvents: 0,
      auditIps: 0,
      emailChallenges: 0,
    });
  });

  it('runs on empty tables', async () => {
    await expect(purgeExpiredLogs(db)).resolves.toEqual({
      accessEvents: 0,
      authEvents: 0,
      auditIps: 0,
      emailChallenges: 0,
    });
  });

  it('deletes expired signup and reset challenges, which hold an email address, and keeps live ones', async () => {
    await challenge('signup-expired', 'signup', -60);
    await challenge('reset-expired', 'reset', -1);
    await challenge('signup-live', 'signup', 600);
    await challenge('reset-live', 'reset', 1800);

    expect(await purgeExpiredLogs(db)).toMatchObject({ emailChallenges: 2 });

    expect(await ids('auth_email_challenges')).toEqual(['reset-live', 'signup-live']);
  });

  it('never tries to delete a row the retention triggers still protect', async () => {
    // One day inside each window: a boundary that disagrees with a trigger would abort the whole batch.
    await accessEvent('access-edge', 394);
    await authEvent('staff-edge', 1, 394);
    await authEvent('member-edge', 0, 89);

    await expect(purgeExpiredLogs(db)).resolves.toBeDefined();

    expect(await ids('admin_access_events')).toEqual(['access-edge']);
    expect(await ids('auth_events')).toEqual(['member-edge', 'staff-edge']);
  });
});

describe('the scheduled handler', () => {
  it('purges through the DB binding and keeps the work alive after the handler returns', async () => {
    vi.doMock('@astrojs/cloudflare/handler', () => ({ handle: vi.fn() }));
    const { default: worker } = await import('../../worker');
    await authEvent('member-old', 0, 91);
    const waiting: Promise<unknown>[] = [];

    await worker.scheduled(
      {
        cron: '17 18 * * *',
        scheduledTime: Date.now(),
        type: 'scheduled',
      } as unknown as ScheduledController,
      { DB: db } as unknown as Env,
      {
        waitUntil: (promise: Promise<unknown>) => waiting.push(promise),
      } as unknown as ExecutionContext,
    );
    await Promise.all(waiting);

    expect(waiting).toHaveLength(1);
    expect(await ids('auth_events')).toEqual([]);
  });

  it('serves requests through the Astro handler', async () => {
    const handle = vi.fn(async () => new Response('ok'));
    vi.resetModules();
    vi.doMock('@astrojs/cloudflare/handler', () => ({ handle }));
    const { default: worker } = await import('../../worker');

    expect(worker.fetch).toBe(handle);
  });
});
