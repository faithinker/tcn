import { newId } from './client';
import type { User } from './types';

const COLUMNS = `id, username, password_hash as passwordHash, display_name as displayName,
  session_version as sessionVersion, created_at as createdAt,
  role, status, is_executive as isExecutive,
  can_access_directors_forum as canAccessDirectorsForum, affiliation, email_verified_at as emailVerifiedAt`;

type UserRow = Omit<User, 'isExecutive' | 'canAccessDirectorsForum'> & {
  isExecutive: number;
  canAccessDirectorsForum: number;
};

// SQLite 에는 boolean 이 없어 0/1 로 저장된다.
function toUser(row: UserRow): User {
  return {
    ...row,
    isExecutive: row.isExecutive === 1,
    canAccessDirectorsForum: row.canAccessDirectorsForum === 1,
  };
}

// 비밀번호 비교는 auth 레이어에서 수행한다.
export async function getUserByUsername(db: D1Database, username: string): Promise<User | null> {
  const row = await db
    .prepare(`select ${COLUMNS} from users where username = ?1 AND deleted_at IS NULL`)
    .bind(username)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const row = await db
    .prepare(`select ${COLUMNS} from users where id = ?1 AND deleted_at IS NULL`)
    .bind(id)
    .first<UserRow>();
  return row ? toUser(row) : null;
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
