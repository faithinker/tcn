import type { ForumBoard } from '../auth/permissions';
import { parseBoard, parsePage, parsePostPayload, parseRevisionPayload } from './payload';

export interface ForumPost {
  id: string;
  board: ForumBoard;
  title: string;
  body: string;
  authorId: string;
  authorName: string | null;
  authorWithdrawn: number;
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
  u.display_name as authorName,(u.deleted_at IS NOT NULL) as authorWithdrawn,p.revision,p.created_at as createdAt,p.updated_at as updatedAt
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

// Rechecked inside each write so a withdrawal cannot race an earlier route guard.
const ACTIVE_FORUM_ACTOR = `exists(select 1 from users actor where actor.id=? and actor.deleted_at is null and actor.status<>'rejected' and (?='assembly' or (actor.status='approved' and (actor.role='officer' or actor.can_access_directors_forum=1))))`;
async function requireCurrentActor(db: D1Database, board: ForumBoard, id: string) {
  if (!(await db.prepare(`select 1 where ${ACTIVE_FORUM_ACTOR}`).bind(id, board).first()))
    throw new ForumForbiddenError();
}

export async function createForumPost(
  db: D1Database,
  input: { board: ForumBoard; title: string; body: string; authorId: string },
): Promise<ForumPost> {
  const board = parseBoard(input.board);
  const { title, body } = parsePostPayload({ title: input.title, body: input.body });
  const id = crypto.randomUUID();
  const result = await db
    .prepare(
      `insert into forum_posts(id,board,title,body,author_id) select ?,?,?,?,? where ${ACTIVE_FORUM_ACTOR}`,
    )
    .bind(id, board, title, body, input.authorId, input.authorId, board)
    .run();
  if (!result.meta.changes) throw new ForumForbiddenError();
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
      `update forum_posts set title=?,body=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=? and board=? and author_id=? and revision=? and deleted_at is null and ${ACTIVE_FORUM_ACTOR}`,
    )
    .bind(title, body, input.id, board, input.authorId, expectedRevision, input.authorId, board)
    .run();
  if (!result.meta.changes) {
    await requireCurrentActor(db, board, input.authorId);
    return explainConflict(db, board, input.id);
  }
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
      `update forum_posts set deleted_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),deleted_by=?,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=? and board=? and revision=? and deleted_at is null and ${ACTIVE_FORUM_ACTOR} and (author_id=? or exists(select 1 from users executive where executive.id=? and executive.deleted_at is null and executive.status='approved' and executive.role='officer' and executive.is_executive=1))`,
    )
    .bind(
      input.actorId,
      input.id,
      board,
      expectedRevision,
      input.actorId,
      board,
      input.actorId,
      input.actorId,
    )
    .run();
  if (!result.meta.changes) {
    await requireCurrentActor(db, board, input.actorId);
    await explainConflict(db, board, input.id);
  }
}
