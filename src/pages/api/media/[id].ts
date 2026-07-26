import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { deleteMedia, getBucket, getDB, getMediaById } from '../../../lib/db';

export const prerender = false;

// 미디어 삭제: 인증 필요. R2 객체 + media 행 실삭제(글의 soft delete 와 별개).
export const DELETE: APIRoute = async ({ request, params }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const db = getDB();
  const media = await getMediaById(db, id);
  if (!media) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  await getBucket().delete(media.r2Key);
  await deleteMedia(db, id);
  return Response.json({ ok: true });
};
