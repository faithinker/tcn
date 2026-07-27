import { newId } from './client';
import type { User } from './types';

const COLUMNS = `id, username, password_hash as passwordHash, display_name as displayName,
  session_version as sessionVersion, created_at as createdAt`;

// 비밀번호 비교는 auth 레이어에서 수행한다.
export async function getUserByUsername(db: D1Database, username: string): Promise<User | null> {
  return (
    (await db
      .prepare(`select ${COLUMNS} from users where username = ?1`)
      .bind(username)
      .first<User>()) ?? null
  );
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  return (
    (await db.prepare(`select ${COLUMNS} from users where id = ?1`).bind(id).first<User>()) ?? null
  );
}

// 계정 발급(수동 스크립트에서 사용). passwordHash 는 이미 해시된 값이어야 한다.
export async function createUser(
  db: D1Database,
  input: { username: string; passwordHash: string; displayName?: string | null },
): Promise<User> {
  const id = newId();
  await db
    .prepare(
      `insert into users (id, username, password_hash, display_name) values (?1, ?2, ?3, ?4)`,
    )
    .bind(id, input.username, input.passwordHash, input.displayName ?? null)
    .run();
  const user = await getUserById(db, id);
  if (!user) throw new Error('createUser: insert did not persist');
  return user;
}

export async function revokeUserSessions(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('update users set session_version = session_version + 1 where id = ?1')
    .bind(id)
    .run();
}
