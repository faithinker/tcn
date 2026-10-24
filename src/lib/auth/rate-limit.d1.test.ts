// 로그인 rate limiter 의 SQL 의미론(윈도 리셋·잠금 해제·잠금 단계 상승)을 실제 SQLite 에서 검증한다(test-support/d1.ts).
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import {
  clearLoginFailures,
  getLoginLockSeconds,
  pruneLoginRateLimits,
  recordLoginFailure,
  resetLoginAttempts,
} from './rate-limit';

const WINDOW = 15 * 60;
const LOCKS = [15 * 60, 60 * 60, 4 * 60 * 60, 24 * 60 * 60];
const KEYS: readonly string[] = ['account:a', 'ip:i'];
const T0 = 1_700_000_000;

let harness: TestD1;
const db = () => harness.db;

beforeAll(async () => {
  harness = await openTestD1();
});
afterAll(async () => {
  await harness.dispose();
});
afterEach(async () => {
  await db().prepare('delete from auth_rate_limits').run();
});

async function rowFor(identifier: string) {
  return db()
    .prepare(
      `select attempts, window_started_at, blocked_until, lock_count
       from auth_rate_limits where identifier = ?1`,
    )
    .bind(identifier)
    .first<{
      attempts: number;
      window_started_at: number;
      blocked_until: number;
      lock_count: number;
    }>();
}

/** 윈도를 채울 만큼 연속 실패시키고 마지막 호출의 남은 잠금 초를 돌려준다. */
async function failUntilLocked(keys: readonly string[], at: number, attempts = 5): Promise<number> {
  let last = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await recordLoginFailure(db(), keys, at);
  }
  return last;
}

describe('login rate limiting against a real D1', () => {
  it('counts both identifiers in one call and locks on the fifth failure', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(recordLoginFailure(db(), KEYS, T0)).resolves.toBe(0);
    }

    // 5회째에 15분 잠금이 걸리고, 남은 초를 돌려준다.
    await expect(recordLoginFailure(db(), KEYS, T0)).resolves.toBe(LOCKS[0]);

    // 하나의 prepared statement 를 여러 번 bind 해도 행이 따로 쌓인다.
    expect(await rowFor('account:a')).toMatchObject({
      attempts: 5,
      blocked_until: T0 + LOCKS[0],
      lock_count: 1,
    });
    expect(await rowFor('ip:i')).toMatchObject({
      attempts: 5,
      blocked_until: T0 + LOCKS[0],
      lock_count: 1,
    });
  });

  it('reports the seconds left on the lock and zero once it has passed', async () => {
    await failUntilLocked(KEYS, T0);

    await expect(getLoginLockSeconds(db(), KEYS, T0)).resolves.toBe(LOCKS[0]);
    await expect(getLoginLockSeconds(db(), KEYS, T0 + 100)).resolves.toBe(LOCKS[0] - 100);
    await expect(getLoginLockSeconds(db(), KEYS, T0 + LOCKS[0] - 1)).resolves.toBe(1);
    await expect(getLoginLockSeconds(db(), KEYS, T0 + LOCKS[0])).resolves.toBe(0);
  });

  it('locks longer each time the lock is earned again, up to a 24 hour cap', async () => {
    let at = T0;
    for (const expected of [...LOCKS, LOCKS[3]]) {
      await expect(failUntilLocked(KEYS, at)).resolves.toBe(expected);
      // 잠금이 풀린 직후 새 윈도에서 다시 5회 실패한다.
      at += expected;
    }

    expect(await rowFor('account:a')).toMatchObject({ lock_count: 5 });
  });

  it('does not count or extend anything for failures that arrive during a lock', async () => {
    await failUntilLocked(KEYS, T0);
    const before = await rowFor('account:a');

    await expect(recordLoginFailure(db(), KEYS, T0 + 60)).resolves.toBe(LOCKS[0] - 60);

    expect(await rowFor('account:a')).toEqual(before);
  });

  it('keeps a long lock alive after the counting window has rolled over', async () => {
    // 1회차 잠금(15분)이 풀린 뒤 2회차(1시간)를 건다.
    await failUntilLocked(KEYS, T0);
    const second = T0 + LOCKS[0];
    await failUntilLocked(KEYS, second);

    // 윈도(15분)는 이미 지났지만 1시간 잠금은 유효하다 — 실패 한 번이 잠금을 풀면 안 된다.
    const during = second + WINDOW + 60;
    await expect(recordLoginFailure(db(), KEYS, during)).resolves.toBe(LOCKS[1] - WINDOW - 60);
    expect(await rowFor('account:a')).toMatchObject({ blocked_until: second + LOCKS[1] });
  });

  it('starts a fresh window of attempts once the lock is over without lowering the lock level', async () => {
    await failUntilLocked(KEYS, T0);

    // 잠금이 끝난 뒤 첫 실패는 1회째로 다시 센다 — 잠금 단계는 그대로 유지한다.
    await expect(recordLoginFailure(db(), KEYS, T0 + LOCKS[0])).resolves.toBe(0);
    expect(await rowFor('account:a')).toMatchObject({
      attempts: 1,
      window_started_at: T0 + LOCKS[0],
      blocked_until: 0,
      lock_count: 1,
    });
  });

  it('locks when either identifier is locked, not only when both are', async () => {
    // IP 만 5회 실패시킨다.
    await failUntilLocked(['ip:i'], T0);

    await expect(getLoginLockSeconds(db(), ['account:untouched', 'ip:i'], T0)).resolves.toBe(
      LOCKS[0],
    );
    await expect(getLoginLockSeconds(db(), ['account:untouched', 'ip:other'], T0)).resolves.toBe(0);
  });

  it('reports the longest remaining lock among the identifiers', async () => {
    await failUntilLocked(['account:a'], T0);
    await failUntilLocked(['account:a'], T0 + LOCKS[0]); // 1시간 잠금
    await failUntilLocked(['ip:i'], T0 + LOCKS[0]); // 15분 잠금

    await expect(getLoginLockSeconds(db(), ['account:a', 'ip:i'], T0 + LOCKS[0])).resolves.toBe(
      LOCKS[1],
    );
  });

  it('allows a device identifier ten failures before it locks', async () => {
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await expect(recordLoginFailure(db(), ['device:d'], T0)).resolves.toBe(0);
    }

    await expect(recordLoginFailure(db(), ['device:d'], T0)).resolves.toBe(LOCKS[0]);
    expect(await rowFor('device:d')).toMatchObject({ attempts: 10, lock_count: 1 });
  });

  it('locks a staff account on the fifth failure and any other account on the tenth', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await recordLoginFailure(db(), KEYS, T0, { strict: true });
    }
    await expect(recordLoginFailure(db(), KEYS, T0, { strict: true })).resolves.toBe(LOCKS[0]);

    await db().prepare('delete from auth_rate_limits').run();
    for (let attempt = 1; attempt <= 9; attempt += 1) {
      await expect(recordLoginFailure(db(), KEYS, T0, { strict: false })).resolves.toBe(0);
    }
    await expect(recordLoginFailure(db(), KEYS, T0, { strict: false })).resolves.toBe(LOCKS[0]);
  });

  it('treats a call without options as the strict staff limit', async () => {
    await expect(failUntilLocked(KEYS, T0, 5)).resolves.toBe(LOCKS[0]);
  });

  it('judges each failure by the class of the account it targets, even on a shared IP row', async () => {
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await recordLoginFailure(db(), ['account:member', 'ip:i'], T0, { strict: false });
    }
    // The IP has six failures and no lock. One failure on a staff account reaches its limit of five.
    await expect(
      recordLoginFailure(db(), ['account:staff', 'ip:i'], T0, { strict: true }),
    ).resolves.toBe(LOCKS[0]);
  });

  it('drops the rows of the given identifiers on a successful login', async () => {
    await recordLoginFailure(db(), KEYS, T0);
    await recordLoginFailure(db(), ['device:d', 'ip:other'], T0);

    await clearLoginFailures(db(), KEYS);

    expect(await rowFor('account:a')).toBeNull();
    expect(await rowFor('ip:i')).toBeNull();
    // 다른 식별자는 건드리지 않는다.
    expect(await rowFor('device:d')).not.toBeNull();
  });

  it('resets the failure count after a success but keeps the lock level and an active lock', async () => {
    // 1회차 잠금이 풀린 뒤 2회차 잠금(1시간)을 걸고, 그 안에서 성공 정리를 한다.
    await failUntilLocked(['account:a'], T0);
    const second = T0 + LOCKS[0];
    await failUntilLocked(['account:a'], second);

    await resetLoginAttempts(db(), ['account:a']);

    expect(await rowFor('account:a')).toMatchObject({
      attempts: 0,
      blocked_until: second + LOCKS[1],
      lock_count: 2,
    });
    // 잠금 단계가 남아 있으니 다음 잠금은 4시간이다 — 관리자의 성공이 공격자의 단계를 되돌리지 못한다.
    await expect(failUntilLocked(['account:a'], second + LOCKS[1])).resolves.toBe(LOCKS[2]);
  });

  it('gives a clean slate for the next window when only some failures had accumulated', async () => {
    await recordLoginFailure(db(), ['account:a'], T0);
    await recordLoginFailure(db(), ['account:a'], T0);

    await resetLoginAttempts(db(), ['account:a']);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(recordLoginFailure(db(), ['account:a'], T0 + 10)).resolves.toBe(0);
    }
    await expect(recordLoginFailure(db(), ['account:a'], T0 + 10)).resolves.toBe(LOCKS[0]);
  });

  it('prunes rows that have been quiet for a week and keeps the rest', async () => {
    const DAY = 24 * 60 * 60;
    await recordLoginFailure(db(), ['account:old'], T0);
    await recordLoginFailure(db(), ['account:recent'], T0 + 8 * DAY);
    await failUntilLocked(['account:locked'], T0 + 8 * DAY);

    await pruneLoginRateLimits(db(), T0 + 8 * DAY);

    expect(await rowFor('account:old')).toBeNull();
    expect(await rowFor('account:recent')).not.toBeNull();
    // 잠금은 24시간 상한이라 7일 지난 행이 아직 잠겨 있을 수 없다 — 잠긴 행은 최근 갱신이라 남는다.
    expect(await rowFor('account:locked')).not.toBeNull();
  });

  it('keeps a row at exactly the cutoff and drops one second older', async () => {
    const WEEK = 7 * 24 * 60 * 60;
    await recordLoginFailure(db(), ['account:edge'], T0);
    await recordLoginFailure(db(), ['account:older'], T0 - 1);

    await pruneLoginRateLimits(db(), T0 + WEEK);

    expect(await rowFor('account:edge')).not.toBeNull();
    expect(await rowFor('account:older')).toBeNull();
  });

  it('is safe to call with no identifiers', async () => {
    await expect(getLoginLockSeconds(db(), [], T0)).resolves.toBe(0);
    await expect(recordLoginFailure(db(), [], T0)).resolves.toBe(0);
    await expect(clearLoginFailures(db(), [])).resolves.toBeUndefined();
    await expect(resetLoginAttempts(db(), [])).resolves.toBeUndefined();
  });
});
