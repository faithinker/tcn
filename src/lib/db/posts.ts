import { newId } from './client';
import type { Post, PostInput } from './types';

const COLUMNS = `id, title, summary, event_date as eventDate, address, body,
  hero_media_id as heroMediaId, author_id as authorId,
  created_at as createdAt, updated_at as updatedAt, deleted_at as deletedAt`;

// 공개 목록: soft delete 제외, 개최일(없으면 생성일) 최신순.
export async function listPosts(db: D1Database): Promise<Post[]> {
  const rs = await db
    .prepare(
      `select ${COLUMNS} from posts
       where deleted_at is null
       order by coalesce(event_date, '') desc, created_at desc`,
    )
    .all<Post>();
  return rs.results;
}

export async function getPost(
  db: D1Database,
  id: string,
  opts: { includeDeleted?: boolean } = {},
): Promise<Post | null> {
  const where = opts.includeDeleted ? 'id = ?1' : 'id = ?1 and deleted_at is null';
  return (await db.prepare(`select ${COLUMNS} from posts where ${where}`).bind(id).first<Post>()) ?? null;
}

export async function createPost(db: D1Database, input: PostInput): Promise<Post> {
  const id = newId();
  await db
    .prepare(
      `insert into posts (id, title, summary, event_date, address, body, hero_media_id, author_id)
       values (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      id,
      input.title,
      input.summary ?? null,
      input.eventDate ?? null,
      input.address ?? null,
      input.body ?? '',
      input.heroMediaId ?? null,
      input.authorId ?? null,
    )
    .run();
  const post = await getPost(db, id, { includeDeleted: true });
  if (!post) throw new Error('createPost: insert did not persist');
  return post;
}

// 부분 수정이 아니라 전체 필드 갱신(폼 전체 저장 전제). 반환 null = 없거나 이미 삭제됨.
export async function updatePost(db: D1Database, id: string, input: PostInput): Promise<Post | null> {
  const result = await db
    .prepare(
      `update posts set title = ?2, summary = ?3, event_date = ?4, address = ?5,
         body = ?6, hero_media_id = ?7, updated_at = unixepoch()
       where id = ?1 and deleted_at is null`,
    )
    .bind(
      id,
      input.title,
      input.summary ?? null,
      input.eventDate ?? null,
      input.address ?? null,
      input.body ?? '',
      input.heroMediaId ?? null,
    )
    .run();
  if (!result.meta.changes) return null;
  return getPost(db, id);
}

// 실삭제 아님: deleted_at 만 세팅해 공개 목록에서 숨김. false = 이미 없거나 삭제됨.
export async function softDeletePost(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare(
      `update posts set deleted_at = unixepoch(), updated_at = unixepoch()
       where id = ?1 and deleted_at is null`,
    )
    .bind(id)
    .run();
  return Boolean(result.meta.changes);
}
