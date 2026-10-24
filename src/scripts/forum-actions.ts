import type { ForumBoard } from '../lib/auth/permissions';
import { ApiRequestError } from '../lib/admin-api';
import { parseBoard, parsePostPayload, parseRevisionPayload } from '../lib/forum/payload';

interface MutationInput {
  action: 'create' | 'edit' | 'hide';
  board: ForumBoard;
  id?: string;
  expectedRevision?: number;
  title?: string;
  body?: string;
  csrf: string;
}

export async function mutateForumPost(
  input: MutationInput,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const board = parseBoard(input.board);
  const payload =
    input.action === 'hide'
      ? parseRevisionPayload({ expectedRevision: input.expectedRevision })
      : input.action === 'edit'
        ? parsePostPayload(
            { title: input.title, body: input.body, expectedRevision: input.expectedRevision },
            true,
          )
        : parsePostPayload({ title: input.title, body: input.body });
  const base = `/api/forum/${board}`;
  if (input.action !== 'create' && !input.id) throw new ApiRequestError('invalid_input', 400);
  let response: Response;
  try {
    response = await fetcher(
      input.action === 'create' ? base : `${base}/${encodeURIComponent(input.id!)}`,
      {
        method: input.action === 'create' ? 'POST' : input.action === 'edit' ? 'PUT' : 'DELETE',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': input.csrf },
        body: JSON.stringify(payload),
      },
    );
  } catch {
    throw new ApiRequestError('network_error', 0);
  }
  let value: { ok?: boolean; error?: string; post?: { id?: unknown; revision?: unknown } };
  try {
    value = await response.json();
  } catch {
    throw new ApiRequestError('invalid_response', response.status);
  }
  if (!response.ok || value?.ok !== true)
    throw new ApiRequestError(value?.error ?? 'request_failed', response.status);
  if (input.action === 'hide') return `/forum/${board}`;
  if (
    typeof value.post?.id !== 'string' ||
    !value.post.id ||
    !Number.isSafeInteger(value.post.revision)
  )
    throw new ApiRequestError('invalid_response', response.status);
  return `/forum/${board}/${encodeURIComponent(value.post.id)}`;
}

export function forumErrorMessage(code: string): string {
  switch (code) {
    case 'revision_conflict':
      return 'This post changed while you were working. Your text is still here. View the latest version before trying again.';
    case 'unauthorized':
      return 'Your session has expired. Sign in again before saving. Keep a copy of your text.';
    case 'forbidden':
      return 'You no longer have permission to change this post. Keep a copy of your text.';
    case 'invalid_csrf':
      return 'Your security token has expired. Keep a copy of your text, then reload this page.';
    case 'not_found':
      return 'This post is no longer available. Keep a copy of your text.';
    case 'member_features_unavailable':
      return 'Member forums are temporarily unavailable. Keep your text and try again later.';
    case 'invalid_input':
      return 'Enter a title of 1–120 characters and a body of 1–10,000 characters. Blank text and NUL characters are not allowed.';
    case 'rate_limited':
      return 'You have posted several times in a short while. Your text is still here. Wait a few minutes before trying again.';
    case 'payload_too_large':
      return 'This post is too large to send. Shorten it to 10,000 characters or fewer. Your text is still here.';
    case 'network_error':
      return 'The connection failed. Your text is still here. Check your connection and try again.';
    default:
      return 'The post could not be saved. Your text is still here. Please try again.';
  }
}
