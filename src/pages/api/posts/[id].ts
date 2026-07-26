import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import {
  getDB,
  getMediaById,
  getPost,
  listSeminarPosts,
  PostRevisionConflictError,
  softDeletePost,
  updatePost,
} from '../../../lib/db';
import { notifyPostChange } from '../../../lib/notify';
import { parsePostPayload } from '../../../lib/post-payload';
import {
  isSeminarDateConflictError,
  validateSeminarDate,
} from '../../../lib/seminar-validation';

export const prerender = false;

function updateErrorResponse(error: unknown): Response | null {
  if (error instanceof PostRevisionConflictError) {
    return Response.json({ ok: false, error: 'revision_conflict' }, { status: 409 });
  }
  if (isSeminarDateConflictError(error)) {
    return Response.json({ ok: false, error: 'event_date_conflict' }, { status: 409 });
  }
  return null;
}

function seminarDateErrorResponse(error: string): Response {
  const invalid = error === 'event_date_required' || error === 'event_date_invalid';
  return Response.json({ ok: false, error }, { status: invalid ? 400 : 409 });
}

// 글 수정(전체 저장). 인증 필요, 권한 없음(flat).
export const PUT: APIRoute = async ({ request, params }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const parsed = parsePostPayload(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  const payload = parsed.value;
  if (!payload.revision) {
    return Response.json({ ok: false, error: 'invalid_revision' }, { status: 400 });
  }

  const db = getDB();
  const [currentPost, seminarPosts] = await Promise.all([getPost(db, id), listSeminarPosts(db)]);
  if (!currentPost) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const eventDate = payload.eventDate;
  const existingDates = seminarPosts.map((post) => post.eventDate).filter((date): date is string => Boolean(date));
  const dateError = validateSeminarDate({
    eventDate,
    currentEventDate: currentPost.eventDate,
    existingDates,
  });
  if (dateError) {
    return seminarDateErrorResponse(dateError);
  }

  if (payload.heroMediaId) {
    const hero = await getMediaById(db, payload.heroMediaId);
    if (!hero || hero.postId !== id || hero.kind !== 'image') {
      return Response.json({ ok: false, error: 'hero_media_invalid' }, { status: 400 });
    }
  }

  let post;
  try {
    post = await updatePost(db, id, {
      title: payload.title,
      summary: payload.summary,
      eventDate,
      address: payload.address,
      body: payload.body,
      heroMediaId: payload.heroMediaId,
      expectedRevision: payload.revision,
    });
  } catch (error) {
    const response = updateErrorResponse(error);
    if (response) return response;
    throw error;
  }
  if (!post) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  // 알림은 베스트에포트 백그라운드 — 저장 응답을 막지 않는다.
  notifyPostChange(request.url, post, 'updated');
  return Response.json({ ok: true, post });
};

// soft delete: deleted_at 만 세팅(실삭제 아님).
export const DELETE: APIRoute = async ({ request, params }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const deleted = await softDeletePost(getDB(), id);
  if (!deleted) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  return Response.json({ ok: true });
};
