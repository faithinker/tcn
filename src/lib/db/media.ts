import { newId } from './client';
import type { Media, MediaInput } from './types';

const COLUMNS = `id, post_id as postId, r2_key as r2Key, kind, mime_type as mimeType,
  filename, size, width, height, duration, position, caption, created_at as createdAt`;

export async function listMediaForPost(db: D1Database, postId: string): Promise<Media[]> {
  const rs = await db
    .prepare(`select ${COLUMNS} from media where post_id = ?1 order by position, created_at`)
    .bind(postId)
    .all<Media>();
  return rs.results;
}

export async function getMediaById(db: D1Database, id: string): Promise<Media | null> {
  return (
    (await db.prepare(`select ${COLUMNS} from media where id = ?1`).bind(id).first<Media>()) ?? null
  );
}

export async function getPublicMediaByKey(db: D1Database, r2Key: string): Promise<Media | null> {
  return (
    (await db
      .prepare(
        `select m.id, m.post_id as postId, m.r2_key as r2Key, m.kind,
          m.mime_type as mimeType, m.filename, m.size, m.width, m.height,
          m.duration, m.position, m.caption, m.created_at as createdAt
         from media m
         join posts p on p.id = m.post_id
         where m.r2_key = ?1 and p.deleted_at is null`,
      )
      .bind(r2Key)
      .first<Media>()) ?? null
  );
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

export async function updateMediaMetadata(
  db: D1Database,
  id: string,
  input: Pick<MediaInput, 'caption' | 'position'>,
): Promise<Media | null> {
  const result = await db
    .prepare('update media set caption = ?2, position = ?3 where id = ?1')
    .bind(id, input.caption ?? null, input.position ?? 0)
    .run();
  if (!result.meta.changes) return null;
  return getMediaById(db, id);
}

// 파일 레코드 실삭제(R2 객체 삭제는 호출측에서 r2Key 로 별도 처리).
export async function deleteMedia(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare(`delete from media where id = ?1`).bind(id).run();
  return Boolean(result.meta.changes);
}

export async function deleteMediaAndQueueCleanup(
  db: D1Database,
  id: string,
  r2Key: string,
): Promise<boolean> {
  const queue = db
    .prepare(
      `insert or ignore into media_cleanup_queue (r2_key)
       select ?2 where exists (select 1 from media where id = ?1)`,
    )
    .bind(id, r2Key);
  const remove = db.prepare('delete from media where id = ?1').bind(id);
  const results = await db.batch([queue, remove]);
  return Boolean(results[1]?.meta.changes);
}

export async function completeMediaCleanup(db: D1Database, r2Key: string): Promise<void> {
  await db.prepare('delete from media_cleanup_queue where r2_key = ?1').bind(r2Key).run();
}

export async function recordMediaCleanupFailure(
  db: D1Database,
  r2Key: string,
  message: string,
): Promise<void> {
  await db
    .prepare(
      `update media_cleanup_queue
       set attempts = attempts + 1, last_error = ?2, updated_at = unixepoch()
       where r2_key = ?1`,
    )
    .bind(r2Key, message.slice(0, 500))
    .run();
}

export async function listMediaCleanupKeys(db: D1Database, limit = 50): Promise<string[]> {
  const result = await db
    .prepare('select r2_key as r2Key from media_cleanup_queue order by created_at limit ?1')
    .bind(Math.max(1, Math.min(limit, 100)))
    .all<{ r2Key: string }>();
  return result.results.map((row) => row.r2Key);
}
