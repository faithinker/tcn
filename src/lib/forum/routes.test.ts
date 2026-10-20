import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  env: { MEMBER_FEATURES_ENABLED: 'true' },
  db: undefined as unknown,
  user: null as unknown,
}));
vi.mock('cloudflare:workers', () => ({ env: state.env }));
vi.mock('../db', () => ({ getDB: () => state.db }));
vi.mock('../auth/guard', () => ({
  getSessionUser: async () => state.user,
  getSessionSecret: () => 'test-secret',
}));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { createCsrfToken } from '../auth/mutation';
import { createForumPost } from './repository';
import { POST } from '../../pages/api/forum/[board]/index';
import { PUT, DELETE } from '../../pages/api/forum/[board]/[id]';

describe('forum routes with SQLite and real mutation security', () => {
  let harness: TestD1;
  let csrf: string;
  const member = {
    id: 'author',
    username: 'private@example.org',
    displayName: 'Author',
    role: 'member',
    status: 'approved',
    isExecutive: false,
    canAccessDirectorsForum: false,
  };
  beforeEach(async () => {
    harness = await openTestD1();
    state.db = harness.db;
    state.user = { ...member };
    state.env.MEMBER_FEATURES_ENABLED = 'true';
    await harness.db
      .prepare(
        "insert into users(id,username,password_hash) values ('author','private@example.org','hash'),('other','other@example.org','hash')",
      )
      .run();
    await harness.db.prepare("UPDATE users SET status='approved'").run();
    csrf = await createCsrfToken('forum', 'session', 'test-secret');
  });
  afterEach(async () => {
    await harness?.dispose();
  });
  function ctx(
    method: string,
    body: unknown,
    board = 'assembly',
    id = 'missing',
    headers: Record<string, string> = {},
  ) {
    return {
      request: new Request(`https://tcn.example/api/forum/${board}/${id}`, {
        method,
        headers: {
          'content-type': 'application/json',
          origin: 'https://tcn.example',
          cookie: 'tcn_session=session',
          'x-csrf-token': csrf,
          ...headers,
        },
        body: JSON.stringify(body),
      }),
      params: { board, id },
    } as never;
  }
  const input = { title: 'Record', body: 'Plain <script>alert(1)</script>' };
  it('creates with session identity and does not expose email', async () => {
    const response = await POST!(ctx('POST', input));
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, post: { authorId: 'author', revision: 1 } });
    expect(JSON.stringify(body)).not.toContain('private@example.org');
  });
  it('fails closed with 503 before checking session when disabled', async () => {
    state.env.MEMBER_FEATURES_ENABLED = 'false';
    state.user = null;
    expect((await POST!(ctx('POST', input))).status).toBe(503);
    expect((await PUT!(ctx('PUT', { ...input, expectedRevision: 1 }))).status).toBe(503);
    expect((await DELETE!(ctx('DELETE', { expectedRevision: 1 }))).status).toBe(503);
  });
  it('returns 401 without session and 403 for rejected members', async () => {
    state.user = null;
    expect((await POST!(ctx('POST', input))).status).toBe(401);
    state.user = { ...member, status: 'rejected' };
    expect((await POST!(ctx('POST', input))).status).toBe(403);
  });
  it('enforces scope, origin and cross-site metadata with real CSRF', async () => {
    const cases: Record<string, string>[] = [
      { 'x-csrf-token': 'bad' },
      { origin: 'https://evil.example' },
      { 'sec-fetch-site': 'cross-site' },
      { 'x-csrf-token': await createCsrfToken('qna', 'session', 'test-secret') },
    ];
    for (const headers of cases)
      expect((await POST!(ctx('POST', input, 'assembly', 'missing', headers))).status).toBe(403);
  });
  it('rejects unknown boards and injected author/revision/body fields', async () => {
    expect((await POST!(ctx('POST', input, 'unknown'))).status).toBe(404);
    for (const body of [
      { ...input, authorId: 'other' },
      { ...input, board: 'directors' },
      { ...input, expectedRevision: 1 },
      { title: 'x\0x', body: 'B' },
    ])
      expect((await POST!(ctx('POST', body))).status).toBe(400);
  });
  it('checks board access before revealing existence and allows approved special access', async () => {
    expect((await PUT!(ctx('PUT', { ...input, expectedRevision: 1 }, 'directors'))).status).toBe(
      403,
    );
    await harness.db
      .prepare("UPDATE users SET can_access_directors_forum=1 WHERE id='author'")
      .run();
    state.user = { ...member, canAccessDirectorsForum: true };
    expect((await POST!(ctx('POST', input, 'directors'))).status).toBe(201);
    state.user = { ...member, status: 'pending', canAccessDirectorsForum: true };
    expect((await POST!(ctx('POST', input, 'directors'))).status).toBe(403);
    expect((await POST!(ctx('POST', input))).status).toBe(201);
  });
  it('blocks board-id spoofing, other-author edits, and stale revisions', async () => {
    const post = await createForumPost(harness.db, {
      ...input,
      board: 'assembly',
      authorId: 'author',
    });
    state.user = { ...member, role: 'officer', isExecutive: true };
    expect(
      (await PUT!(ctx('PUT', { ...input, expectedRevision: 1 }, 'directors', post.id))).status,
    ).toBe(404);
    await harness.db
      .prepare("UPDATE users SET role='officer',is_executive=1 WHERE id='other'")
      .run();
    state.user = { ...member, id: 'other', role: 'officer', isExecutive: true };
    expect(
      (await PUT!(ctx('PUT', { ...input, expectedRevision: 1 }, 'assembly', post.id))).status,
    ).toBe(403);
    state.user = { ...member };
    expect(
      (
        await PUT!(
          ctx('PUT', { ...input, title: 'Updated', expectedRevision: 1 }, 'assembly', post.id),
        )
      ).status,
    ).toBe(200);
    expect(
      (await PUT!(ctx('PUT', { ...input, expectedRevision: 1 }, 'assembly', post.id))).status,
    ).toBe(409);
  });
  it('permits executive hide but denies ordinary non-author and lost access', async () => {
    const post = await createForumPost(harness.db, {
      ...input,
      board: 'assembly',
      authorId: 'author',
    });
    state.user = { ...member, id: 'other' };
    expect(
      (await DELETE!(ctx('DELETE', { expectedRevision: 1 }, 'assembly', post.id))).status,
    ).toBe(403);
    state.user = { ...member, status: 'rejected' };
    expect(
      (await DELETE!(ctx('DELETE', { expectedRevision: 1 }, 'assembly', post.id))).status,
    ).toBe(403);
    await harness.db
      .prepare("UPDATE users SET role='officer',is_executive=1 WHERE id='other'")
      .run();
    state.user = { ...member, id: 'other', role: 'officer', isExecutive: true };
    expect(
      (await DELETE!(ctx('DELETE', { expectedRevision: 2 }, 'assembly', post.id))).status,
    ).toBe(409);
    expect(
      (await DELETE!(ctx('DELETE', { expectedRevision: 1 }, 'assembly', post.id))).status,
    ).toBe(200);
    expect(
      (await DELETE!(ctx('DELETE', { expectedRevision: 2 }, 'assembly', post.id))).status,
    ).toBe(404);
  });
});
