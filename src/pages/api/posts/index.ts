import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { createPost, getDB, listSeminarPosts } from '../../../lib/db';
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

// 글 생성: 인증 필요. 권한 없음(인증된 누구나) — 설계상 flat.
export const POST: APIRoute = async ({ request }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const payload = (await request.json().catch(() => null)) as PostPayload | null;
  const title = payload?.title?.trim();
  if (!title) return Response.json({ ok: false, error: 'title_required' }, { status: 400 });

  const db = getDB();
  const eventDate = payload?.eventDate?.trim() || null;
  const existingDates = (await listSeminarPosts(db)).map((post) => post.eventDate).filter((date): date is string => Boolean(date));
  const dateError = validateSeminarDate({ eventDate, existingDates });
  if (dateError) {
    const status = dateError === 'event_date_required' || dateError === 'event_date_invalid' ? 400 : 409;
    return Response.json({ ok: false, error: dateError }, { status });
  }

  let post;
  try {
    post = await createPost(db, {
      title,
      summary: payload?.summary?.trim() || null,
      eventDate,
      address: payload?.address?.trim() || null,
      body: payload?.body ?? '',
      heroMediaId: payload?.heroMediaId ?? null,
      authorId: uid,
    });
  } catch (error) {
    if (isSeminarDateConflictError(error)) {
      return Response.json({ ok: false, error: 'event_date_conflict' }, { status: 409 });
    }
    throw error;
  }
  // 알림은 베스트에포트 백그라운드 — 저장 응답을 막지 않는다.
  notifyPostChange(request.url, post, 'created');
  return Response.json({ ok: true, post });
};
