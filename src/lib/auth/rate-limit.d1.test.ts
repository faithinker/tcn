// 로그인 rate limiter 의 SQL 의미론을 실제 D1 에서 검증한다.
//
// rate-limit.test.ts 는 D1 을 목킹하므로 bind 인자와 batch 형태만 본다.
// 윈도 리셋·잠금 해제 같은 판단은 전부 SQL 안에 있어서 목으로는 닿지 않는다.
// 여기서는 workerd + SQLite 를 띄워 실제 동작을 고정한다.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { clearLoginFailures, isLoginRateLimited, recordLoginFailure } from './rate-limit';

const WINDOW = 15 * 60;
const KEYS: readonly [string, string] = ['account:a', 'ip:i'];
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
      'select attempts, window_started_at, blocked_until from auth_rate_limits where identifier = ?1',
    )
    .bind(identifier)
    .first<{ attempts: number; window_started_at: number; blocked_until: number }>();
}

describe('login rate limiting against a real D1', () => {
  it('counts both identifiers in one call and blocks on the fifth failure', async () => {
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(recordLoginFailure(db(), KEYS, T0)).resolves.toBe(false);
    }

    // 5회째에 잠금이 걸린다.
    await expect(recordLoginFailure(db(), KEYS, T0)).resolves.toBe(true);

    // 하나의 prepared statement 를 두 번 bind 해도 두 행이 따로 쌓인다.
    expect(await rowFor('account:a')).toMatchObject({ attempts: 5, blocked_until: T0 + WINDOW });
    expect(await rowFor('ip:i')).toMatchObject({ attempts: 5, blocked_until: T0 + WINDOW });
  });

  it('keeps the block until blocked_until has passed', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await recordLoginFailure(db(), KEYS, T0);
    }

    await expect(isLoginRateLimited(db(), KEYS, T0 + WINDOW - 1)).resolves.toBe(true);
    await expect(isLoginRateLimited(db(), KEYS, T0 + WINDOW)).resolves.toBe(false);
  });

  it('resets the counter and clears the block once the window has rolled over', async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await recordLoginFailure(db(), KEYS, T0);
    }

    // 윈도가 지난 뒤의 첫 실패는 1회째로 다시 센다.
    await expect(recordLoginFailure(db(), KEYS, T0 + WINDOW)).resolves.toBe(false);
    expect(await rowFor('account:a')).toMatchObject({
      attempts: 1,
      window_started_at: T0 + WINDOW,
      blocked_until: 0,
    });
  });

  it('blocks when either identifier is blocked, not only when both are', async () => {
    // IP 만 5회 실패시킨다.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await recordLoginFailure(db(), ['ip:i', 'ip:i'], T0);
    }

    await expect(isLoginRateLimited(db(), ['account:untouched', 'ip:i'], T0)).resolves.toBe(true);
    await expect(isLoginRateLimited(db(), ['account:untouched', 'ip:other'], T0)).resolves.toBe(
      false,
    );
  });

  it('drops both rows on a successful login', async () => {
    await recordLoginFailure(db(), KEYS, T0);
    await clearLoginFailures(db(), KEYS);

    expect(await rowFor('account:a')).toBeNull();
    expect(await rowFor('ip:i')).toBeNull();
  });
});
