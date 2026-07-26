import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { addMedia, getBucket, getDB, getPost, newId } from '../../../lib/db';
import {
  classifyUpload,
  UploadError,
  validateUpload,
  type ValidatedUpload,
} from '../../../lib/media/validate';

export const prerender = false;

function uploadError(error: unknown): Response {
  const code = error instanceof UploadError ? error.message : 'invalid_upload';
  const status = code.endsWith('_too_large')
    ? 413
    : code === 'unsupported_media_type'
      ? 415
      : 400;
  return Response.json({ ok: false, error: code }, { status });
}

// Raw-body upload. Images are capped at 10 MiB and inspected in memory; larger documents/videos
// stream directly to R2 so the Worker never duplicates an entire large file in its 128 MiB isolate.
export const POST: APIRoute = async ({ request }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const contentLengthValue = request.headers.get('content-length');
  if (!contentLengthValue) {
    return Response.json({ ok: false, error: 'content_length_required' }, { status: 411 });
  }
  const size = Number(contentLengthValue);
  const mimeType = request.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? '';

  let classified: ValidatedUpload;
  try {
    classified = classifyUpload(mimeType, size);
  } catch (error) {
    return uploadError(error);
  }

  const url = new URL(request.url);
  const postId = url.searchParams.get('postId')?.trim() ?? '';
  const filename = url.searchParams.get('filename')?.trim() ?? '';
  const rawPosition = Number(url.searchParams.get('position') ?? '0');
  if (
    !postId ||
    !filename ||
    filename.length > 255 ||
    !Number.isSafeInteger(rawPosition) ||
    rawPosition < 0
  ) {
    return Response.json({ ok: false, error: 'invalid_upload_metadata' }, { status: 400 });
  }

  const db = getDB();
  if (!(await getPost(db, postId))) {
    return Response.json({ ok: false, error: 'post_not_found' }, { status: 404 });
  }

  let body: ReadableStream | Uint8Array | null = request.body;
  let validated = classified;
  if (classified.kind === 'image') {
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength !== size) {
      return Response.json({ ok: false, error: 'content_length_mismatch' }, { status: 400 });
    }
    try {
      validated = validateUpload(mimeType, bytes);
    } catch (error) {
      return uploadError(error);
    }
    body = bytes;
  }
  if (!body) return Response.json({ ok: false, error: 'empty_file' }, { status: 400 });

  const key = `${postId}/${newId()}.${validated.extension}`;
  const bucket = getBucket();
  await bucket.put(key, body, { httpMetadata: { contentType: mimeType } });

  try {
    const media = await addMedia(db, {
      postId,
      r2Key: key,
      kind: validated.kind,
      mimeType,
      filename,
      size,
      width: validated.width,
      height: validated.height,
      position: rawPosition,
      caption: null,
    });
    return Response.json({ ok: true, media });
  } catch (error) {
    try {
      await bucket.delete(key);
    } catch (cleanupError) {
      console.error('media upload: failed to compensate R2 object', { key, cleanupError });
    }
    throw error;
  }
};
