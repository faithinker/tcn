import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { getDB, getPost, listSeminarPosts, softDeletePost, updatePost } from '../../../lib/db';
import { notifyPostChange } from '../../../lib/notify';
import {
  isSeminarDateConflictError,
  validateSeminarDate,
} from '../../../lib/seminar-validation';

export const prerender = false;

interface PostPayload {
  title?: string;
  summary?: string;
  eventDate?: string;
  address?: string;
  body?: string;
  heroMediaId?: string | null;
}

// 글 수정(전체 저장). 인증 필요, 권한 없음(flat).
export const PUT: APIRoute = async ({ request, params }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const payload = (await request.json().catch(() => null)) as PostPayload | null;
  const title = payload?.title?.trim();
  if (!title) return Response.json({ ok: false, error: 'title_required' }, { status: 400 });

  const db = getDB();
  const [currentPost, seminarPosts] = await Promise.all([getPost(db, id), listSeminarPosts(db)]);
  if (!currentPost) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  const eventDate = payload?.eventDate?.trim() || null;
  const existingDates = seminarPosts.map((post) => post.eventDate).filter((date): date is string => Boolean(date));
  const dateError = validateSeminarDate({
    eventDate,
    currentEventDate: currentPost.eventDate,
    existingDates,
  });
  if (dateError) {
    const status = dateError === 'event_date_required' || dateError === 'event_date_invalid' ? 400 : 409;
    return Response.json({ ok: false, error: dateError }, { status });
  }

  let post;
  try {
    post = await updatePost(db, id, {
      title,
      summary: payload?.summary?.trim() || null,
      eventDate,
      address: payload?.address?.trim() || null,
      body: payload?.body ?? '',
      heroMediaId: payload?.heroMediaId ?? null,
    });
  } catch (error) {
    if (isSeminarDateConflictError(error)) {
      return Response.json({ ok: false, error: 'event_date_conflict' }, { status: 409 });
    }
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
