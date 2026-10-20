import type { APIRoute } from 'astro';
import { requireMutation, SecurityError } from '../../../../lib/auth/mutation';
import { canAccess } from '../../../../lib/auth/permissions';
import { getDB } from '../../../../lib/db';
import { memberFeaturesEnabled, memberFeatureUnavailable } from '../../../../lib/member-features';
import { parseBoard, parsePostPayload } from '../../../../lib/forum/payload';
import { createForumPost, ForumNotFoundError } from '../../../../lib/forum/repository';
import { forumError, forumJson } from '../../../../lib/forum/response';

export const prerender = false;
export const POST: APIRoute = async ({ request, params }) => {
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  try {
    const { user } = await requireMutation(request, { scope: 'forum', require: 'activeAccount' });
    if (params.board !== 'assembly' && params.board !== 'directors') throw new ForumNotFoundError();
    const board = parseBoard(params.board);
    if (!canAccess(user, { kind: 'forum.write', board })) throw new SecurityError('forbidden', 403);
    const payload = parsePostPayload(await request.json());
    const post = await createForumPost(getDB(), { ...payload, board, authorId: user.id });
    return forumJson({ ok: true, post }, 201);
  } catch (error) {
    return forumError(error);
  }
};
