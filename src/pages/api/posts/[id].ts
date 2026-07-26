import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { getDB, softDeletePost, updatePost } from '../../../lib/db';
import { notifyPostChange } from '../../../lib/notify';

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

  const post = await updatePost(getDB(), id, {
    title,
    summary: payload?.summary?.trim() || null,
    eventDate: payload?.eventDate?.trim() || null,
    address: payload?.address?.trim() || null,
    body: payload?.body ?? '',
    heroMediaId: payload?.heroMediaId ?? null,
  });
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
