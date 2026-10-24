import { SecurityError } from '../auth/mutation';
import { QnaPayloadError } from '../qna/payload';
import { ForumInputError } from './payload';
import { ForumForbiddenError, ForumNotFoundError, ForumRevisionConflictError } from './repository';
import { ForumRateLimitError } from './write-limit';

export function forumJson(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow' },
  });
}

export function forumError(error: unknown): Response {
  if (error instanceof SecurityError)
    return forumJson({ ok: false, error: error.code }, error.status);
  if (error instanceof ForumNotFoundError) return forumJson({ ok: false, error: 'not_found' }, 404);
  if (error instanceof ForumForbiddenError)
    return forumJson({ ok: false, error: 'forbidden' }, 403);
  if (error instanceof ForumRevisionConflictError)
    return forumJson({ ok: false, error: 'revision_conflict' }, 409);
  if (error instanceof ForumRateLimitError)
    return Response.json(
      { ok: false, error: 'rate_limited' },
      {
        status: 429,
        headers: {
          'cache-control': 'no-store',
          'x-robots-tag': 'noindex, nofollow',
          'retry-after': String(error.retryAfter),
        },
      },
    );
  if (error instanceof QnaPayloadError)
    return forumJson(
      { ok: false, error: error.message },
      error.message === 'payload_too_large' ? 413 : 400,
    );
  if (error instanceof ForumInputError || error instanceof SyntaxError)
    return forumJson({ ok: false, error: 'invalid_input' }, 400);
  console.error('Forum request failed', error instanceof Error ? error.name : 'unknown');
  return forumJson({ ok: false, error: 'internal_error' }, 500);
}
