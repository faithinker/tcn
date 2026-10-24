import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import {
  ACCESS_LOG_RETENTION_DAYS,
  ACCESS_LOG_RETENTION_MONTHS,
  accessLogIp,
  accessLogUnavailable,
  recordUsersListView,
} from './access-log';
import { mutateUser } from './repository';

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);
let harness: TestD1;
let db: D1Database;
// async so a trigger abort surfaces as a rejection, as it does on D1.
const execute = async (sql: string, ...params: unknown[]) =>
  db
    .prepare(sql)
    .bind(...params)
    .run();
const events = async () =>
  (await db.prepare('select * from admin_access_events order by created_at').all()).results as {
    id: string;
    actor_id: string;
    action: string;
    scope: string;
    subject_ids: string;
    subject_count: number;
    ip: string | null;
    created_at: number;
  }[];
const backdated = (id: string, days: number) =>
  execute(
    `insert into admin_access_events(id,actor_id,action,scope,subject_ids,subject_count,ip,created_at)
     values(?,'actor','users_list_viewed','status=pending;page=1','[]',0,'198.51.100.1',?)`,
    id,
    now() - days * DAY,
  );
const view = (overrides: Partial<Parameters<typeof recordUsersListView>[1]> = {}) =>
  recordUsersListView(db, {
    actorId: 'actor',
    ip: '203.0.113.10',
    status: 'pending',
    page: 1,
    subjectIds: ['t1', 't2'],
    ...overrides,
  });

beforeEach(async () => {
  harness = await openTestD1();
  db = harness.db;
  await execute(
    `insert into users(id,username,password_hash,role,status,is_executive) values
     ('actor','actor','hash','officer','approved',1),
     ('officer','officer','hash','officer','approved',0),
     ('t1','t1','hash','member','pending',0),
     ('t2','t2','hash','member','pending',0)`,
  );
});
afterEach(async () => harness.dispose());

describe('recording a /admin/users view', () => {
  it('writes one event with the actor, IP, condition and the accounts shown', async () => {
    await view({ page: 2, subjectIds: ['t1', 'actor', 't1'] });
    const [event, ...rest] = await events();
    expect(rest).toHaveLength(0);
    expect(event).toMatchObject({
      actor_id: 'actor',
      action: 'users_list_viewed',
      scope: 'status=pending;page=2',
      subject_count: 2,
      ip: '203.0.113.10',
    });
    expect(JSON.parse(event.subject_ids)).toEqual(['t1', 'actor']);
    expect(Math.abs(event.created_at - now())).toBeLessThan(5);
  });

  it('records an empty list and a missing IP', async () => {
    await view({ subjectIds: [], ip: null });
    expect(await events()).toMatchObject([{ subject_ids: '[]', subject_count: 0, ip: null }]);
  });

  it('rejects a viewer who is not an approved executive and writes nothing', async () => {
    await expect(view({ actorId: 'officer' })).rejects.toThrow(/access_log_actor_forbidden/);
    await expect(view({ actorId: 'ghost' })).rejects.toThrow();
    await execute("update users set status='rejected' where id='actor'");
    await expect(view()).rejects.toThrow(/access_log_actor_forbidden/);
    expect(await events()).toHaveLength(0);
  });

  it('rejects subject lists that are not a JSON array matching the count', async () => {
    const insert = (subjectIds: string, count: number) =>
      execute(
        `insert into admin_access_events(id,actor_id,action,scope,subject_ids,subject_count,created_at)
         values('x','actor','users_list_viewed','s',?,?,1)`,
        subjectIds,
        count,
      );
    await expect(insert('not json', 0)).rejects.toThrow(/access_log_invalid_subjects/);
    await expect(insert('{"a":1}', 1)).rejects.toThrow(/access_log_invalid_subjects/);
    await expect(insert('["t1"]', 2)).rejects.toThrow(/access_log_invalid_subjects/);
    expect(await events()).toHaveLength(0);
  });

  it('rolls the whole batch back when the write fails, so expired rows survive a failed view', async () => {
    await backdated('old', ACCESS_LOG_RETENTION_DAYS + 1);
    await expect(view({ actorId: 'ghost' })).rejects.toThrow();
    expect((await events()).map((event) => event.id)).toEqual(['old']);
  });
});

describe('immutability and retention', () => {
  it('refuses to change an event', async () => {
    await view();
    await expect(execute("update admin_access_events set ip='198.51.100.9'")).rejects.toThrow(
      /access_log_immutable/,
    );
    await expect(execute("update admin_access_events set actor_id='officer'")).rejects.toThrow(
      /access_log_immutable/,
    );
    expect((await events())[0].ip).toBe('203.0.113.10');
  });

  it('refuses to delete an event inside the retention window and allows it after', async () => {
    await view();
    await backdated('inside', ACCESS_LOG_RETENTION_DAYS - 1);
    await backdated('outside', ACCESS_LOG_RETENTION_DAYS + 1);
    await expect(execute('delete from admin_access_events')).rejects.toThrow(/access_log_retained/);
    await expect(execute("delete from admin_access_events where id='inside'")).rejects.toThrow(
      /access_log_retained/,
    );
    await execute("delete from admin_access_events where id='outside'");
    expect(await events()).toHaveLength(2);
  });

  it('deletes expired events and clears expired audit IPs on each recorded view, keeping the rest', async () => {
    await backdated('expired', ACCESS_LOG_RETENTION_DAYS + 1);
    await backdated('recent', 30);
    const change = (targetId: string, requestId: string, ip: string | null) =>
      mutateUser(db, {
        actorId: 'actor',
        targetId,
        kind: 'status',
        value: { status: 'approved' },
        expectedRevision: 1,
        requestId,
        ip,
      });
    await change('t1', 'audit-request-1', '203.0.113.1');
    await change('t2', 'audit-request-2', '203.0.113.2');
    await execute(
      "update user_audit_events set created_at=? where target_id='t1'",
      now() - (ACCESS_LOG_RETENTION_DAYS + 1) * DAY,
    );
    await view();
    expect((await events()).map((event) => event.id)).not.toContain('expired');
    expect((await events()).map((event) => event.id)).toContain('recent');
    expect(await events()).toHaveLength(2);
    expect(
      (await db.prepare('select target_id,ip from user_audit_events order by target_id').all())
        .results,
    ).toEqual([
      { target_id: 't1', ip: null },
      { target_id: 't2', ip: '203.0.113.2' },
    ]);
  });
});

describe('the retention period', () => {
  it('is one value in code, the trigger and the policy text', () => {
    const migration = readFileSync(
      new URL('../../../migrations/0012_admin_access_log.sql', import.meta.url),
      'utf8',
    );
    expect(migration).toContain(`${ACCESS_LOG_RETENTION_DAYS} * 86400`);
    expect(ACCESS_LOG_RETENTION_MONTHS).toBe(13);
    expect(Math.round(ACCESS_LOG_RETENTION_DAYS / 30.4)).toBe(ACCESS_LOG_RETENTION_MONTHS);
  });
});

describe('accessLogIp', () => {
  const from = (ip: string | null) =>
    new Request('https://tcn.test/', ip === null ? {} : { headers: { 'cf-connecting-ip': ip } });
  it('keeps the connecting address verbatim', () => {
    expect(accessLogIp(from('203.0.113.10'))).toBe('203.0.113.10');
    expect(accessLogIp(from('2001:db8:1:2:aaaa:bbbb:cccc:dddd'))).toBe(
      '2001:db8:1:2:aaaa:bbbb:cccc:dddd',
    );
  });
  it('returns null when the header is missing or is not an address', () => {
    expect(accessLogIp(from(null))).toBeNull();
    expect(accessLogIp(from('unknown; drop table'))).toBeNull();
    expect(accessLogIp(from('1'.repeat(60)))).toBeNull();
  });
});

describe('the page', () => {
  it('answers 503 with a no-store JSON body when the log is unavailable', async () => {
    const response = accessLogUnavailable();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: false, error: 'access_log_unavailable' });
  });

  // Source-shape guard, not a behavior test: the browser gate covers the rendered page.
  it('records after the guard and argument checks and before the list is rendered, failing closed', () => {
    const page = readFileSync(
      new URL('../../pages/admin/users/index.astro', import.meta.url),
      'utf8',
    );
    const at = (needle: string) => {
      const index = page.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at('requireExecutivePage('),
      at("return Astro.redirect('/admin/users')"),
      at('if (users.page !== Number(rawPage))'),
      at('await recordUsersListView('),
      at('return accessLogUnavailable()'),
      at('createCsrfToken('),
      at('<AdminLayout'),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
