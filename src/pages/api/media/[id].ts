import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { deleteMedia, getBucket, getDB, getMediaById, updateMediaMetadata } from '../../../lib/db';
import { normalizeMediaMetadata, type MediaMetadataPayload } from '../../../lib/media-metadata';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const payload = (await request.json().catch(() => null)) as MediaMetadataPayload | null;
  if (!payload) return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });

  let metadata;
  try {
    metadata = normalizeMediaMetadata(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_metadata';
    return Response.json({ ok: false, error: message }, { status: 400 });
  }

  const media = await updateMediaMetadata(getDB(), id, metadata);
  if (!media) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  return Response.json({ ok: true, media });
};

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
