import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
// Calls through, so the real hash check runs while a test can count how many guesses reached it.
vi.mock('../auth/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth/password')>();
  return { ...actual, verifyPassword: vi.fn(actual.verifyPassword) };
});
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { hashPassword, verifyPassword } from '../auth/password';
import { getUserById, getUserByUsername } from '../db/users';
import { getForumPost, createForumPost, updateForumPost, hideForumPost } from '../forum/repository';
import { countPendingUsers, getManagedUser, mutateUser } from '../users/repository';
import { AccountError } from './policy';
import { updateProfile, replacePassword, withdrawAccount, reauthenticate } from './repository';
let h: TestD1;
let db: D1Database;
let user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
beforeEach(async () => {
  h = await openTestD1();
  db = h.db;
  const hash = await hashPassword('An old password by the river');
  await db
    .prepare(
      "INSERT INTO users(id,username,password_hash,display_name,affiliation,role,status,is_executive) VALUES ('member','member@example.org',?,'Researcher','Institute','member','pending',0),('executive','executive','!','Chair',NULL,'officer','approved',1)",
    )
    .bind(hash)
    .run();
  user = (await getUserById(db, 'member'))!;
});
afterEach(async () => h.dispose());
describe('account mutations on real SQLite', () => {
  it('updates only the session owner profile without consuming admin revision', async () => {
    await updateProfile(db, user, { displayName: 'New name', affiliation: '' });
    expect(
      await db
        .prepare("select display_name,affiliation,revision from users where id='member'")
        .first(),
    ).toEqual({ display_name: 'New name', affiliation: null, revision: 1 });
    await mutateUser(db, {
      actorId: 'executive',
      targetId: 'member',
      kind: 'status',
      value: { status: 'approved' },
      expectedRevision: 1,
      requestId: 'approval-0001',
    });
    expect(await getUserById(db, 'member')).toMatchObject({ status: 'approved' });
  });
  it('rejects immutable email and privilege fields without partial writes', async () => {
    await expect(
      updateProfile(db, user, { displayName: 'Changed', email: 'other@example.org' }),
    ).rejects.toMatchObject({ code: 'invalid_fields' });
    expect(await getUserById(db, 'member')).toMatchObject({
      displayName: 'Researcher',
      username: 'member@example.org',
    });
  });
  it('replaces a password and invalidates old session snapshots', async () => {
    await expect(
      replacePassword(db, user, 'member-quiet-river-phrase', 'member-quiet-river-phrase'),
    ).rejects.toMatchObject({ code: 'weak_password' });
    await expect(
      replacePassword(db, user, '123456789012345', '123456789012345'),
    ).rejects.toMatchObject({ code: 'weak_password' });
    await replacePassword(db, user, 'Fifteen or more characters', 'Fifteen or more characters');
    const updated = (await getUserById(db, 'member'))!;
    expect(updated.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await verifyPassword('Fifteen or more characters', updated.passwordHash)).toBe(true);
    await expect(updateProfile(db, user, { displayName: 'Stale' })).rejects.toMatchObject({
      status: 401,
    });
  });
  it('keeps legacy normalization while new passwords normalize NFC', async () => {
    await replacePassword(
      db,
      user,
      'A long cafe\u0301 beside the river',
      'A long café beside the river',
    );
    const updated = (await getUserById(db, 'member'))!;
    expect(await verifyPassword('A long cafe\u0301 beside the river', updated.passwordHash)).toBe(
      true,
    );
    expect(await verifyPassword('A long café beside the river', updated.passwordHash)).toBe(true);
  });
  it('reauthenticates independently of login lockouts and revokes on the fifth failure', async () => {
    await db
      .prepare(
        "INSERT INTO auth_rate_limits(identifier,attempts,window_started_at,blocked_until,lock_count,updated_at) VALUES ('account:unrelated',5,0,9999999999,1,0)",
      )
      .run();
    await reauthenticate(db, user, 'An old password by the river');
    for (let i = 0; i < 5; i++)
      await expect(reauthenticate(db, user, 'wrong')).rejects.toMatchObject({
        code: i === 4 ? 'session_ended' : 'invalid_credentials',
      });
    expect((await getUserById(db, 'member'))?.sessionVersion).toBe(user.sessionVersion + 1);
  });
  it('checks at most five passwords when guesses arrive in parallel, then ends the session', async () => {
    vi.mocked(verifyPassword).mockClear();
    const outcomes = await Promise.all(
      Array.from({ length: 12 }, () => reauthenticate(db, user, 'wrong').catch((e: unknown) => e)),
    );
    expect(vi.mocked(verifyPassword).mock.calls.length).toBeLessThanOrEqual(5);
    expect(outcomes.every((e) => e instanceof AccountError)).toBe(true);
    expect(outcomes.filter((e) => (e as AccountError).code === 'session_ended').length).toBe(8);
    expect((await getUserById(db, 'member'))?.sessionVersion).toBe(user.sessionVersion + 1);
  });
  it('still accepts the right password on the fifth attempt and clears the count', async () => {
    for (let i = 0; i < 4; i++)
      await expect(reauthenticate(db, user, 'wrong')).rejects.toMatchObject({
        code: 'invalid_credentials',
      });
    await reauthenticate(db, user, 'An old password by the river');
    expect(
      await db
        .prepare("select count(*) as n from account_reauth_failures where user_id='member'")
        .first(),
    ).toEqual({ n: 0 });
  });
  it('withdraws without deleting authors or revealing their previous identity', async () => {
    await db
      .prepare(
        "INSERT INTO forum_posts(id,board,title,body,author_id) VALUES ('post','assembly','Title','Body','member')",
      )
      .run();
    await withdrawAccount(db, user, 'withdrawal-0001');
    expect(await getUserById(db, 'member')).toBeNull();
    expect(await getUserByUsername(db, 'member@example.org')).toBeNull();
    expect(await getManagedUser(db, 'member')).toBeNull();
    expect(await countPendingUsers(db)).toBe(0);
    expect(await getForumPost(db, 'assembly', 'post')).toMatchObject({
      authorId: 'member',
      authorName: null,
      authorWithdrawn: 1,
    });
    const row = await db
      .prepare(
        "select username,password_hash,display_name,affiliation,session_version,deleted_at from users where id='member'",
      )
      .first();
    expect(row).toMatchObject({
      username: 'withdrawn:member',
      password_hash: '!',
      display_name: null,
      affiliation: null,
      session_version: user.sessionVersion + 1,
    });
    await expect(updateProfile(db, user, { displayName: 'Restore' })).rejects.toMatchObject({
      status: 401,
    });
    expect(() =>
      db.prepare("UPDATE users SET deleted_at=NULL,display_name='Restore' WHERE id='member'").run(),
    ).toThrow();
  });
  it('does not consume session or credentials if final withdrawal bookkeeping fails', async () => {
    await db
      .prepare(
        "CREATE TRIGGER fail_withdrawal BEFORE INSERT ON account_events BEGIN SELECT RAISE(ABORT,'forced failure'); END",
      )
      .run();
    await expect(withdrawAccount(db, user, 'withdrawal-0002')).rejects.toThrow();
    expect(await getUserById(db, 'member')).toMatchObject({
      sessionVersion: user.sessionVersion,
      username: user.username,
    });
  });
  it('answers a withdrawal from a stale session with 401 and leaves the account untouched', async () => {
    await db.prepare("UPDATE users SET session_version=session_version+1 WHERE id='member'").run();
    const error = await withdrawAccount(db, user, 'withdrawal-0004').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountError);
    expect(error).toMatchObject({ code: 'unauthorized', status: 401 });
    expect(await getUserById(db, 'member')).toMatchObject({ username: user.username });
    expect(
      (
        await db.prepare("select count(*) as n from account_events where user_id='member'").first<{
          n: number;
        }>()
      )?.n,
    ).toBe(0);
  });
  it('denies writes and admin approvals after withdrawal', async () => {
    await withdrawAccount(db, user, 'withdrawal-0003');
    await expect(
      replacePassword(db, user, 'A fresh phrase by the river', 'A fresh phrase by the river'),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      mutateUser(db, {
        actorId: 'executive',
        targetId: 'member',
        kind: 'status',
        value: { status: 'approved' },
        expectedRevision: 1,
        requestId: 'approval-0002',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

it('rejects forum mutations from a session whose owner withdrew after authorization', async () => {
  await db
    .prepare(
      "INSERT INTO forum_posts(id,board,title,body,author_id) VALUES ('stale-post','assembly','Title','Body','member')",
    )
    .run();
  await withdrawAccount(db, user, 'withdrawal-stale-forum');
  await expect(
    createForumPost(db, { board: 'assembly', title: 'Late post', body: 'Body', authorId: user.id }),
  ).rejects.toThrow();
  await expect(
    updateForumPost(db, {
      board: 'assembly',
      id: 'stale-post',
      title: 'Late edit',
      body: 'Body',
      authorId: user.id,
      expectedRevision: 1,
    }),
  ).rejects.toThrow();
  await expect(
    hideForumPost(db, {
      board: 'assembly',
      id: 'stale-post',
      actorId: user.id,
      expectedRevision: 1,
    }),
  ).rejects.toThrow();
  expect(await getForumPost(db, 'assembly', 'stale-post')).toMatchObject({
    title: 'Title',
    revision: 1,
  });
});
