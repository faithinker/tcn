// 질문 등록 rate limiter 의 SQL 의미론을 실제 D1 에서 검증한다.
//
// security.test.ts 는 D1 을 목킹하고 쿼리 문자열에 'short_attempts < 3' 이 들어 있는지만
// 확인한다. 단기/일일 두 윈도가 실제로 어떻게 리셋되고 어느 쪽 Retry-After 가 이기는지는
// SQL 안에서 결정되므로 목으로는 닿지 않는다.
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// security.ts -> auth/guard.ts 가 워커 전역 env 를 끌어온다. rate limiter 는 쓰지 않는다.
vi.mock('cloudflare:workers', () => ({ env: {} }));

import { openTestD1, type TestD1 } from '../../test-support/d1';
import { consumeQuestionRateLimit } from './security';

const SHORT_WINDOW = 10 * 60;
const DAY_WINDOW = 24 * 60 * 60;
const SHORT_LIMIT = 3;
const DAY_LIMIT = 20;
const KEY = 'qna:hashed-ip';
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
  await db().prepare('delete from qna_rate_limits').run();
});

async function seed(row: {
  shortStartedAt: number;
  shortAttempts: number;
  dayStartedAt: number;
  dayAttempts: number;
}) {
  await db()
    .prepare(
      `insert into qna_rate_limits
         (identifier, short_window_started_at, short_attempts,
          day_window_started_at, day_attempts, updated_at)
       values (?1, ?2, ?3, ?4, ?5, ?2)`,
    )
    .bind(KEY, row.shortStartedAt, row.shortAttempts, row.dayStartedAt, row.dayAttempts)
    .run();
}

async function counters() {
  return db()
    .prepare(
      `select short_attempts, short_window_started_at, day_attempts, day_window_started_at
       from qna_rate_limits where identifier = ?1`,
    )
    .bind(KEY)
    .first<{
      short_attempts: number;
      short_window_started_at: number;
      day_attempts: number;
      day_window_started_at: number;
    }>();
}

describe('question rate limiting against a real D1', () => {
  it('allows the first three questions in a short window and blocks the fourth', async () => {
    for (let n = 1; n <= SHORT_LIMIT; n += 1) {
      await expect(consumeQuestionRateLimit(db(), KEY, T0)).resolves.toEqual({
        allowed: true,
        retryAfter: 0,
      });
    }

    await expect(consumeQuestionRateLimit(db(), KEY, T0)).resolves.toEqual({
      allowed: false,
      retryAfter: SHORT_WINDOW,
    });
  });

  it('leaves the counters untouched when a call is refused', async () => {
    for (let n = 1; n <= SHORT_LIMIT; n += 1) {
      await consumeQuestionRateLimit(db(), KEY, T0);
    }
    await consumeQuestionRateLimit(db(), KEY, T0);
    await consumeQuestionRateLimit(db(), KEY, T0);

    // 거부된 호출은 조건부 UPSERT 의 where 에서 걸러지므로 카운터를 올리지 않는다.
    expect(await counters()).toMatchObject({ short_attempts: SHORT_LIMIT, day_attempts: 3 });
  });

  it('resets the short counter after its window but keeps counting toward the day limit', async () => {
    await seed({
      shortStartedAt: T0,
      shortAttempts: SHORT_LIMIT,
      dayStartedAt: T0,
      dayAttempts: 5,
    });

    await expect(consumeQuestionRateLimit(db(), KEY, T0 + SHORT_WINDOW)).resolves.toEqual({
      allowed: true,
      retryAfter: 0,
    });

    expect(await counters()).toMatchObject({
      short_attempts: 1,
      short_window_started_at: T0 + SHORT_WINDOW,
      day_attempts: 6,
      day_window_started_at: T0,
    });
  });

  it('blocks on the day limit even when the short window is fresh', async () => {
    const at = T0 + 5 * SHORT_WINDOW;
    await seed({
      shortStartedAt: at,
      shortAttempts: 0,
      dayStartedAt: T0,
      dayAttempts: DAY_LIMIT,
    });

    await expect(consumeQuestionRateLimit(db(), KEY, at)).resolves.toEqual({
      allowed: false,
      retryAfter: T0 + DAY_WINDOW - at,
    });
  });

  it('reports the longer of the two waits when both windows are exhausted', async () => {
    const at = T0 + DAY_WINDOW - 100;
    await seed({
      shortStartedAt: at,
      shortAttempts: SHORT_LIMIT,
      dayStartedAt: T0,
      dayAttempts: DAY_LIMIT,
    });

    // 단기는 600초, 일일은 100초 남았으므로 긴 쪽이 이긴다.
    await expect(consumeQuestionRateLimit(db(), KEY, at)).resolves.toEqual({
      allowed: false,
      retryAfter: SHORT_WINDOW,
    });
  });

  it('never reports a non-positive Retry-After', async () => {
    await seed({
      shortStartedAt: T0,
      shortAttempts: SHORT_LIMIT,
      dayStartedAt: T0,
      dayAttempts: DAY_LIMIT,
    });

    // 두 윈도가 모두 만료된 시각이면 UPSERT 가 통과하므로, 경계 직전 시각을 쓴다.
    const at = T0 + SHORT_WINDOW - 1;
    const result = await consumeQuestionRateLimit(db(), KEY, at);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('separates identifiers so one visitor cannot exhaust another', async () => {
    for (let n = 1; n <= SHORT_LIMIT; n += 1) {
      await consumeQuestionRateLimit(db(), KEY, T0);
    }

    await expect(consumeQuestionRateLimit(db(), 'qna:someone-else', T0)).resolves.toEqual({
      allowed: true,
      retryAfter: 0,
    });
  });
});
