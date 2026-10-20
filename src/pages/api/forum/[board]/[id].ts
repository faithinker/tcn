import type { APIRoute } from 'astro';
import { requireMutation, SecurityError } from '../../../../lib/auth/mutation';
import { canAccess } from '../../../../lib/auth/permissions';
import { getDB } from '../../../../lib/db';
import { memberFeaturesEnabled, memberFeatureUnavailable } from '../../../../lib/member-features';
import { parseBoard, parsePostPayload, parseRevisionPayload } from '../../../../lib/forum/payload';
import {
  getForumPost,
  updateForumPost,
  hideForumPost,
  ForumNotFoundError,
} from '../../../../lib/forum/repository';
import { forumError, forumJson } from '../../../../lib/forum/response';

export const prerender = false;
export const PUT: APIRoute = async ({ request, params }) => {
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  try {
    const { user } = await requireMutation(request, { scope: 'forum', require: 'activeAccount' });
    if (params.board !== 'assembly' && params.board !== 'directors') throw new ForumNotFoundError();
    const board = parseBoard(params.board);
    if (!canAccess(user, { kind: 'forum.read', board })) throw new SecurityError('forbidden', 403);
    const db = getDB();
    const post = await getForumPost(db, board, params.id ?? '');
    if (!post) throw new ForumNotFoundError();
    if (!canAccess(user, { kind: 'forum.edit', board, authorId: post.authorId }))
      throw new SecurityError('forbidden', 403);
    const payload = parsePostPayload(await request.json(), true);
    const updated = await updateForumPost(db, {
      ...payload,
      board,
      id: post.id,
      authorId: user.id,
    });
    return forumJson({ ok: true, post: updated });
  } catch (error) {
    return forumError(error);
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  if (!memberFeaturesEnabled()) return memberFeatureUnavailable();
  try {
    const { user } = await requireMutation(request, { scope: 'forum', require: 'activeAccount' });
    if (params.board !== 'assembly' && params.board !== 'directors') throw new ForumNotFoundError();
    const board = parseBoard(params.board);
    if (!canAccess(user, { kind: 'forum.read', board })) throw new SecurityError('forbidden', 403);
    const db = getDB();
    const post = await getForumPost(db, board, params.id ?? '');
    if (!post) throw new ForumNotFoundError();
    if (!canAccess(user, { kind: 'forum.delete', board, authorId: post.authorId }))
      throw new SecurityError('forbidden', 403);
    const payload = parseRevisionPayload(await request.json());
    await hideForumPost(db, { ...payload, board, id: post.id, actorId: user.id });
    return forumJson({ ok: true });
  } catch (error) {
    return forumError(error);
  }
};
