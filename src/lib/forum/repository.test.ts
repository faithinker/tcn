import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import {
  createForumPost,
  getForumPost,
  listForumPosts,
  updateForumPost,
  hideForumPost,
  ForumNotFoundError,
  ForumRevisionConflictError,
} from './repository';

describe('forum repository on SQLite', () => {
  let harness: TestD1;
  beforeEach(async () => {
    harness = await openTestD1();
    await harness.db
      .prepare(
        "insert into users(id,username,password_hash,display_name) values ('author','private@example.org','secret','Author'), ('other','other@example.org','secret',null)",
      )
      .run();
    await harness.db
      .prepare("UPDATE users SET role='officer',status='approved' WHERE id='author'")
      .run();
  });
  afterEach(async () => {
    await harness?.dispose();
  });
  const input = {
    board: 'assembly' as const,
    title: 'Title',
    body: '<b>Plain</b>\ntext',
    authorId: 'author',
  };
  it('creates and reads only safe author information within the URL board', async () => {
    const post = await createForumPost(harness.db, input);
    expect(post).toMatchObject({ ...input, authorName: 'Author', revision: 1 });
    expect(JSON.stringify(post)).not.toMatch(/private@|secret|username|password/);
    expect(await getForumPost(harness.db, 'directors', post.id)).toBeNull();
  });
  it('paginates twenty rows in stable newest-first order and separates boards', async () => {
    for (let i = 0; i < 21; i++)
      await harness.db
        .prepare(
          "insert into forum_posts(id,board,title,body,author_id,created_at) values (?, 'assembly','T','B','author','2026-10-20T00:00:00.000Z')",
        )
        .bind(String(i).padStart(2, '0'))
        .run();
    await createForumPost(harness.db, { ...input, board: 'directors' });
    const page = await listForumPosts(harness.db, { board: 'assembly', page: 2 });
    expect(page).toMatchObject({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(page.posts.map((p) => p.id)).toEqual(['00']);
  });
  it('enforces author, board, revision and hidden CAS on updates', async () => {
    const post = await createForumPost(harness.db, input);
    const change = { ...input, id: post.id, title: 'Changed', expectedRevision: 1 };
    await expect(updateForumPost(harness.db, { ...change, authorId: 'other' })).rejects.toThrow();
    await expect(
      updateForumPost(harness.db, { ...change, board: 'directors' }),
    ).rejects.toBeInstanceOf(ForumNotFoundError);
    expect(await updateForumPost(harness.db, change)).toMatchObject({
      title: 'Changed',
      revision: 2,
    });
    await expect(updateForumPost(harness.db, change)).rejects.toBeInstanceOf(
      ForumRevisionConflictError,
    );
    await expect(
      hideForumPost(harness.db, {
        board: 'assembly',
        id: post.id,
        actorId: 'author',
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(ForumRevisionConflictError);
    await hideForumPost(harness.db, {
      board: 'assembly',
      id: post.id,
      actorId: 'author',
      expectedRevision: 2,
    });
    expect(await getForumPost(harness.db, 'assembly', post.id)).toBeNull();
    expect((await listForumPosts(harness.db, { board: 'assembly', page: 1 })).total).toBe(0);
    await expect(
      updateForumPost(harness.db, { ...change, expectedRevision: 3 }),
    ).rejects.toBeInstanceOf(ForumNotFoundError);
    expect(
      await harness.db
        .prepare('select revision,deleted_by from forum_posts where id=?')
        .bind(post.id)
        .first(),
    ).toMatchObject({ revision: 3, deleted_by: 'author' });
  });
  it('SQLite rejects invalid boards, NUL, lengths, revision and orphan authors', async () => {
    for (const [board, title, body, author, revision] of [
      ['other', 'T', 'B', 'author', 1],
      ['assembly', '', 'B', 'author', 1],
      ['assembly', 'T', 'x\0x', 'author', 1],
      ['assembly', 'x'.repeat(121), 'B', 'author', 1],
      ['assembly', 'T', 'B', 'missing', 1],
      ['assembly', 'T', 'B', 'author', 0],
    ]) {
      await expect(async () =>
        harness.db
          .prepare(
            'insert into forum_posts(id,board,title,body,author_id,revision) values (?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), board, title, body, author, revision)
          .run(),
      ).rejects.toThrow();
    }
  });
});
