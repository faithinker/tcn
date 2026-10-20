import type { APIRoute } from 'astro';
import { requireOfficerMutation } from '../../../lib/auth';
import { createPost, getDB, listSeminarPosts } from '../../../lib/db';
import { notifyPostChange } from '../../../lib/notify';
import { parsePostPayload } from '../../../lib/posts';
import { isSeminarDateConflictError, validateSeminarDate } from '../../../lib/seminars';

export const prerender = false;

// 글 생성: 승인된 임원만(동일 출처 + Fetch Metadata + posts 범위 CSRF 검증).
export const POST: APIRoute = async ({ request }) => {
  const guard = await requireOfficerMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = parsePostPayload(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ ok: false, error: parsed.error }, { status: 400 });
  const payload = parsed.value;
  if (payload.heroMediaId) {
    return Response.json({ ok: false, error: 'hero_media_invalid' }, { status: 400 });
  }

  const db = getDB();
  const eventDate = payload.eventDate;
  const existingDates = (await listSeminarPosts(db))
    .map((post) => post.eventDate)
    .filter((date): date is string => Boolean(date));
  const dateError = validateSeminarDate({ eventDate, existingDates });
  if (dateError) {
    const status =
      dateError === 'event_date_required' || dateError === 'event_date_invalid' ? 400 : 409;
    return Response.json({ ok: false, error: dateError }, { status });
  }

  let post;
  try {
    post = await createPost(db, {
      title: payload.title,
      summary: payload.summary,
      eventDate,
      address: payload.address,
      body: payload.body,
      heroMediaId: null,
      authorId: guard.user.id,
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
