import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import {
  AUTH_LOG_MEMBER_RETENTION_DAYS,
  AUTH_LOG_STAFF_RETENTION_DAYS,
  isStaffAccount,
  recordAuthEvent,
} from './auth-log';

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
  (await db.prepare('select * from auth_events order by created_at, id').all()).results as {
    id: string;
    user_id: string | null;
    event: string;
    staff: number;
    ip: string | null;
    created_at: number;
  }[];
const req = (ip?: string) =>
  new Request('https://tcn.example/api/auth/login', {
    headers: ip === undefined ? {} : { 'cf-connecting-ip': ip },
  });
const backdated = (id: string, staff: 0 | 1, days: number) =>
  execute(
    `insert into auth_events(id,user_id,event,staff,ip,created_at) values(?,NULL,'login_failure',?,'198.51.100.1',?)`,
    id,
    staff,
    now() - days * DAY,
  );

beforeEach(async () => {
  harness = await openTestD1();
  db = harness.db;
  await execute(
    `insert into users(id,username,password_hash,role,status,is_executive) values
     ('exec','exec','hash','officer','approved',1),
     ('officer','officer','hash','officer','approved',0),
     ('member','member','hash','member','approved',0),
     ('pending','pending','hash','member','pending',0),
     ('former','former','hash','officer','rejected',0)`,
  );
});
afterEach(() => harness.dispose());

describe('retention constants', () => {
  it('match the trigger windows', () => {
    expect(AUTH_LOG_STAFF_RETENTION_DAYS).toBe(395);
    expect(AUTH_LOG_MEMBER_RETENTION_DAYS).toBe(90);
  });
});

describe('isStaffAccount', () => {
  it('is true only for an approved officer', () => {
    expect(isStaffAccount({ role: 'officer', status: 'approved' })).toBe(true);
    expect(isStaffAccount({ role: 'officer', status: 'rejected' })).toBe(false);
    expect(isStaffAccount({ role: 'member', status: 'approved' })).toBe(false);
    expect(isStaffAccount(null)).toBe(false);
  });
});

describe('recordAuthEvent', () => {
  it('stores the account, event, IP and time', async () => {
    const before = now();
    await expect(
      recordAuthEvent(db, { userId: 'exec', event: 'login_success', request: req('203.0.113.10') }),
    ).resolves.toBe(true);

    const [row] = await events();
    expect(row).toMatchObject({
      user_id: 'exec',
      event: 'login_success',
      staff: 1,
      ip: '203.0.113.10',
    });
    expect(row.created_at).toBeGreaterThanOrEqual(before);
    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('marks approved officers as staff and everyone else as not, from the database', async () => {
    for (const userId of ['exec', 'officer', 'member', 'pending', 'former']) {
      await recordAuthEvent(db, { userId, event: 'login_success', request: req() });
    }
    const staff = Object.fromEntries((await events()).map((row) => [row.user_id, row.staff]));
    expect(staff).toEqual({ exec: 1, officer: 1, member: 0, pending: 0, former: 0 });
  });

  it('records an attempt on an unknown account with no account id', async () => {
    await recordAuthEvent(db, {
      userId: null,
      event: 'login_failure',
      request: req('203.0.113.11'),
    });
    expect(await events()).toEqual([
      expect.objectContaining({ user_id: null, event: 'login_failure', staff: 0 }),
    ]);
  });

  it('drops an IP that is not an address instead of storing arbitrary text', async () => {
    await recordAuthEvent(db, {
      userId: 'member',
      event: 'logout',
      request: req('not an ip; drop'),
    });
    expect((await events())[0].ip).toBeNull();
  });

  it('never throws: a failed write answers false and logs without personal data', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const failing = {
        batch: () => Promise.reject(new Error('d1 down 203.0.113.10')),
        prepare: () => ({ bind: () => ({}) }),
      } as unknown as D1Database;

      await expect(
        recordAuthEvent(failing, {
          userId: 'exec',
          event: 'login_success',
          request: req('203.0.113.10'),
        }),
      ).resolves.toBe(false);

      expect(error).toHaveBeenCalledTimes(1);
      const logged = String(error.mock.calls[0][0]);
      expect(JSON.parse(logged)).toEqual({ event: 'auth_log_failed', kind: 'login_success' });
      expect(logged).not.toContain('203.0.113.10');
      expect(logged).not.toContain('exec');
    } finally {
      error.mockRestore();
    }
  });

  describe('retrying a write', () => {
    // A D1 whose first batch call can fail before or after it commits.
    const flaky = (failures: number, commitFirst = false) => {
      const ids: unknown[] = [];
      let calls = 0;
      const wrapper = {
        prepare: (sql: string) => {
          const statement = db.prepare(sql);
          if (!sql.startsWith('INSERT')) return statement;
          const bind = statement.bind.bind(statement);
          statement.bind = (...args: unknown[]) => {
            ids.push(args[0]);
            return bind(...args);
          };
          return statement;
        },
        batch: async (statements: D1PreparedStatement[]) => {
          calls += 1;
          if (calls > failures) return db.batch(statements);
          if (commitFirst) await db.batch(statements);
          throw new Error('d1 blip');
        },
      } as unknown as D1Database;
      return { wrapper, ids, calls: () => calls };
    };
    const quiet = () => ({
      warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
    });
    const event = { userId: 'exec', event: 'login_success', request: req('203.0.113.10') } as const;

    it('writes once by default and does not retry', async () => {
      const spies = quiet();
      try {
        const d1 = flaky(1);
        await expect(recordAuthEvent(d1.wrapper, event)).resolves.toBe(false);
        expect(d1.calls()).toBe(1);
      } finally {
        spies.warn.mockRestore();
        spies.error.mockRestore();
      }
    });

    it('retries a failed write once with the same id and reports the retry, not a failure', async () => {
      const spies = quiet();
      try {
        const d1 = flaky(1);
        await expect(recordAuthEvent(d1.wrapper, event, { attempts: 2 })).resolves.toBe(true);

        expect(d1.calls()).toBe(2);
        expect(new Set(d1.ids).size).toBe(1);
        expect(await events()).toHaveLength(1);
        expect(spies.error).not.toHaveBeenCalled();
        expect(spies.warn).toHaveBeenCalledTimes(1);
        expect(JSON.parse(String(spies.warn.mock.calls[0][0]))).toEqual({
          event: 'auth_log_retried',
          kind: 'login_success',
        });
      } finally {
        spies.warn.mockRestore();
        spies.error.mockRestore();
      }
    });

    it('writes one row when the first attempt committed but its answer was lost', async () => {
      const spies = quiet();
      try {
        const d1 = flaky(1, true);
        await expect(recordAuthEvent(d1.wrapper, event, { attempts: 2 })).resolves.toBe(true);
        expect(await events()).toHaveLength(1);
      } finally {
        spies.warn.mockRestore();
        spies.error.mockRestore();
      }
    });

    it('gives up after the last attempt and logs one failure without personal data', async () => {
      const spies = quiet();
      try {
        const d1 = flaky(2);
        await expect(recordAuthEvent(d1.wrapper, event, { attempts: 2 })).resolves.toBe(false);

        expect(d1.calls()).toBe(2);
        expect(await events()).toEqual([]);
        expect(spies.error).toHaveBeenCalledTimes(1);
        expect(JSON.parse(String(spies.error.mock.calls[0][0]))).toEqual({
          event: 'auth_log_failed',
          kind: 'login_success',
        });
      } finally {
        spies.warn.mockRestore();
        spies.error.mockRestore();
      }
    });

    it('still rejects a row the table refuses instead of ignoring it', async () => {
      const spies = quiet();
      try {
        await expect(
          recordAuthEvent(
            db,
            { userId: 'exec', event: 'other' as never, request: req() },
            {
              attempts: 2,
            },
          ),
        ).resolves.toBe(false);
        expect(await events()).toEqual([]);
      } finally {
        spies.warn.mockRestore();
        spies.error.mockRestore();
      }
    });
  });

  it('deletes expired rows of each class when it writes, and keeps the rest', async () => {
    await backdated('staff-old', 1, 400);
    await backdated('staff-kept', 1, 100);
    await backdated('member-old', 0, 100);
    await backdated('member-kept', 0, 60);

    await recordAuthEvent(db, { userId: 'member', event: 'login_success', request: req() });

    const ids = (await events()).map((row) => row.id);
    expect(ids).toContain('staff-kept');
    expect(ids).toContain('member-kept');
    expect(ids).not.toContain('staff-old');
    expect(ids).not.toContain('member-old');
  });
});

describe('triggers', () => {
  it('reject any update', async () => {
    await backdated('e1', 1, 1);
    await expect(execute("update auth_events set ip=NULL where id='e1'")).rejects.toThrow(
      /auth_log_immutable/,
    );
  });

  it('keep a staff row for 395 days and any other row for 90 days', async () => {
    await backdated('staff-390', 1, 390);
    await backdated('member-60', 0, 60);
    await expect(execute("delete from auth_events where id='staff-390'")).rejects.toThrow(
      /auth_log_retained/,
    );
    await expect(execute("delete from auth_events where id='member-60'")).rejects.toThrow(
      /auth_log_retained/,
    );

    await backdated('staff-400', 1, 400);
    await backdated('member-100', 0, 100);
    await execute("delete from auth_events where id='staff-400'");
    await execute("delete from auth_events where id='member-100'");
    expect((await events()).map((row) => row.id).sort()).toEqual(['member-60', 'staff-390']);
  });

  it('reject an unknown event and a staff flag other than 0 or 1', async () => {
    await expect(
      execute("insert into auth_events(id,event,staff,created_at) values('x','other',0,1)"),
    ).rejects.toThrow();
    await expect(
      execute("insert into auth_events(id,event,staff,created_at) values('y','logout',2,1)"),
    ).rejects.toThrow();
  });
});
