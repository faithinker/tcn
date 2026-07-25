import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { createPost, getDB } from '../../../lib/db';

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

  const post = await createPost(getDB(), {
    title,
    summary: payload?.summary?.trim() || null,
    eventDate: payload?.eventDate?.trim() || null,
    address: payload?.address?.trim() || null,
    body: payload?.body ?? '',
    heroMediaId: payload?.heroMediaId ?? null,
    authorId: uid,
  });
  return Response.json({ ok: true, post });
};
