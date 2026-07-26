import type { APIRoute } from 'astro';
import { getSessionUid } from '../../../lib/auth';
import { addMedia, getBucket, getDB, getPost, newId } from '../../../lib/db';
import { UploadError, validateUpload } from '../../../lib/media/validate';

export const prerender = false;

// 미디어 업로드: 인증 필요. multipart 로 postId + file(+ caption/position). R2 저장 후 media 행 생성.
export const POST: APIRoute = async ({ request }) => {
  const uid = await getSessionUid(request);
  if (!uid) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ ok: false, error: 'invalid_form' }, { status: 400 });

  const postId = String(form.get('postId') ?? '');
  const file = form.get('file');
  const caption = form.get('caption') ? String(form.get('caption')) : null;
  const position = Number.parseInt(String(form.get('position') ?? '0'), 10) || 0;
  if (!postId || !(file instanceof File)) {
    return Response.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const db = getDB();
  const post = await getPost(db, postId);
  if (!post) return Response.json({ ok: false, error: 'post_not_found' }, { status: 404 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  let validated;
  try {
    validated = validateUpload(file.type, bytes);
  } catch (error) {
    const message = error instanceof UploadError ? error.message : 'invalid_upload';
    return Response.json({ ok: false, error: message }, { status: 415 });
  }

  const key = `${postId}/${newId()}.${validated.extension}`;
  await getBucket().put(key, bytes, { httpMetadata: { contentType: file.type } });

  const media = await addMedia(db, {
    postId,
    r2Key: key,
    kind: validated.kind,
    mimeType: file.type,
    filename: file.name,
    size: bytes.byteLength,
    width: validated.width,
    height: validated.height,
    position,
    caption,
  });

  return Response.json({ ok: true, media });
};
