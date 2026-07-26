import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import {
  completeMediaCleanup,
  deleteMediaAndQueueCleanup,
  getBucket,
  getDB,
  getMediaById,
  recordMediaCleanupFailure,
  updateMediaMetadata,
} from '../../../lib/db';
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

// D1에서 공개 레코드와 cleanup 작업을 원자적으로 기록한 뒤 R2 삭제를 시도한다.
export const DELETE: APIRoute = async ({ request, params }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const id = params.id;
  if (!id) return Response.json({ ok: false, error: 'missing_id' }, { status: 400 });

  const db = getDB();
  const media = await getMediaById(db, id);
  if (!media) return Response.json({ ok: false, error: 'not_found' }, { status: 404 });

  if (!(await deleteMediaAndQueueCleanup(db, id, media.r2Key))) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    await getBucket().delete(media.r2Key);
    await completeMediaCleanup(db, media.r2Key);
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'R2 cleanup failed';
    console.error('media delete: R2 cleanup queued', { key: media.r2Key, error });
    await recordMediaCleanupFailure(db, media.r2Key, message);
    return Response.json({ ok: true, cleanupPending: true }, { status: 202 });
  }
};
