import { SecurityError } from '../auth/mutation';
import { ForumInputError } from './payload';
import { ForumForbiddenError, ForumNotFoundError, ForumRevisionConflictError } from './repository';

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
  if (error instanceof ForumInputError || error instanceof SyntaxError)
    return forumJson({ ok: false, error: 'invalid_input' }, 400);
  console.error('Forum request failed', error instanceof Error ? error.name : 'unknown');
  return forumJson({ ok: false, error: 'internal_error' }, 500);
}
