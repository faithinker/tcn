import type { ForumBoard } from '../auth/permissions';
import { parseBoard, parsePage, parsePostPayload, parseRevisionPayload } from './payload';

export interface ForumPost {
  id: string;
  board: ForumBoard;
  title: string;
  body: string;
  authorId: string;
  authorName: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
export class ForumNotFoundError extends Error {
  constructor() {
    super('not_found');
  }
}
export class ForumRevisionConflictError extends Error {
  constructor() {
    super('revision_conflict');
  }
}
export class ForumForbiddenError extends Error {
  constructor() {
    super('forbidden');
  }
}

const SELECT = `select p.id,p.board,p.title,p.body,p.author_id as authorId,
  u.display_name as authorName,p.revision,p.created_at as createdAt,p.updated_at as updatedAt
  from forum_posts p join users u on u.id=p.author_id`;

export async function listForumPosts(db: D1Database, input: { board: ForumBoard; page: number }) {
  const board = parseBoard(input.board);
  const page = parsePage(String(input.page));
  const count = await db
    .prepare('select count(*) as total from forum_posts where board=? and deleted_at is null')
    .bind(board)
    .first<{ total: number }>();
  const { results } = await db
    .prepare(
      `${SELECT} where p.board=? and p.deleted_at is null order by p.created_at desc,p.id desc limit 20 offset ?`,
    )
    .bind(board, (page - 1) * 20)
    .all<ForumPost>();
  return {
    posts: results,
    page,
    pageSize: 20,
    total: count?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((count?.total ?? 0) / 20)),
  };
}

export async function getForumPost(
  db: D1Database,
  board: ForumBoard,
  id: string,
): Promise<ForumPost | null> {
  parseBoard(board);
  return db
    .prepare(`${SELECT} where p.board=? and p.id=? and p.deleted_at is null`)
    .bind(board, id)
    .first<ForumPost>();
}

export async function createForumPost(
  db: D1Database,
  input: { board: ForumBoard; title: string; body: string; authorId: string },
): Promise<ForumPost> {
  const board = parseBoard(input.board);
  const { title, body } = parsePostPayload({ title: input.title, body: input.body });
  const id = crypto.randomUUID();
  await db
    .prepare('insert into forum_posts(id,board,title,body,author_id) values (?,?,?,?,?)')
    .bind(id, board, title, body, input.authorId)
    .run();
  return (await getForumPost(db, board, id))!;
}

async function explainConflict(db: D1Database, board: ForumBoard, id: string): Promise<never> {
  if (!(await getForumPost(db, board, id))) throw new ForumNotFoundError();
  throw new ForumRevisionConflictError();
}

export async function updateForumPost(
  db: D1Database,
  input: {
    board: ForumBoard;
    id: string;
    title: string;
    body: string;
    authorId: string;
    expectedRevision: number;
  },
): Promise<ForumPost> {
  const board = parseBoard(input.board);
  const { title, body, expectedRevision } = parsePostPayload(
    { title: input.title, body: input.body, expectedRevision: input.expectedRevision },
    true,
  );
  const current = await getForumPost(db, board, input.id);
  if (!current) throw new ForumNotFoundError();
  if (current.authorId !== input.authorId) throw new ForumForbiddenError();
  const result = await db
    .prepare(
      `update forum_posts set title=?,body=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=? and board=? and author_id=? and revision=? and deleted_at is null`,
    )
    .bind(title, body, input.id, board, input.authorId, expectedRevision)
    .run();
  if (!result.meta.changes) return explainConflict(db, board, input.id);
  return (await getForumPost(db, board, input.id))!;
}

// Caller must first authorize forum.delete (author or executive) for this board.
export async function hideForumPost(
  db: D1Database,
  input: { board: ForumBoard; id: string; actorId: string; expectedRevision: number },
): Promise<void> {
  const board = parseBoard(input.board);
  const { expectedRevision } = parseRevisionPayload({ expectedRevision: input.expectedRevision });
  const result = await db
    .prepare(
      `update forum_posts set deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),deleted_by=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=? and board=? and revision=? and deleted_at is null`,
    )
    .bind(input.actorId, input.id, board, expectedRevision)
    .run();
  if (!result.meta.changes) await explainConflict(db, board, input.id);
}
