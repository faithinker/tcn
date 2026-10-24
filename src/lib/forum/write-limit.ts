import type { SessionUser } from '../auth/permissions';
import { consumeQuestionRateLimit, type RateLimits } from '../qna/security';

// A post or edit counts against a per-account allowance, so one signed-up account cannot spend the D1 write budget.
// A pending account, which only needs the assembly board to introduce itself, gets the smaller one.
const MEMBER_LIMITS: RateLimits = { short: 6, day: 40 };
const PENDING_LIMITS: RateLimits = { short: 3, day: 10 };

export class ForumRateLimitError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super('rate_limited');
    this.retryAfter = retryAfter;
  }
}

export async function consumeForumWrite(db: D1Database, user: SessionUser): Promise<void> {
  const limits = user.status === 'pending' ? PENDING_LIMITS : MEMBER_LIMITS;
  const result = await consumeQuestionRateLimit(
    db,
    `forum:${user.id}`,
    Math.floor(Date.now() / 1_000),
    limits,
  );
  if (!result.allowed) throw new ForumRateLimitError(result.retryAfter);
}
