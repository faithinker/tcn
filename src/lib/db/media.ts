import { newId } from './client';
import type { Media, MediaInput } from './types';

const COLUMNS = `id, post_id as postId, r2_key as r2Key, kind, mime_type as mimeType,
  filename, size, width, height, duration, position, caption, created_at as createdAt`;

// 한 글의 미디어: 갤러리 순서(position), 그다음 생성순.
export async function listMediaForPost(db: D1Database, postId: string): Promise<Media[]> {
  const rs = await db
    .prepare(`select ${COLUMNS} from media where post_id = ?1 order by position, created_at`)
    .bind(postId)
    .all<Media>();
  return rs.results;
}

export async function getMediaById(db: D1Database, id: string): Promise<Media | null> {
  return (await db.prepare(`select ${COLUMNS} from media where id = ?1`).bind(id).first<Media>()) ?? null;
}

export async function addMedia(db: D1Database, input: MediaInput): Promise<Media> {
  const id = newId();
  await db
    .prepare(
      `insert into media
         (id, post_id, r2_key, kind, mime_type, filename, size, width, height, duration, position, caption)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      id,
      input.postId,
      input.r2Key,
      input.kind,
      input.mimeType ?? null,
      input.filename ?? null,
      input.size ?? null,
      input.width ?? null,
      input.height ?? null,
      input.duration ?? null,
      input.position ?? 0,
      input.caption ?? null,
    )
    .run();
  const media = await getMediaById(db, id);
  if (!media) throw new Error('addMedia: insert did not persist');
  return media;
}

// 파일 레코드 실삭제(R2 객체 삭제는 호출측에서 r2Key 로 별도 처리).
export async function deleteMedia(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`delete from media where id = ?1`).bind(id).run();
  return Boolean(result.meta.changes);
}
