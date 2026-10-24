import { describe, expect, it, vi } from 'vitest';

// client.ts 가 cloudflare:workers 를 import 하므로 다른 db 테스트(posts.test.ts)처럼 모킹한다.
vi.mock('./client', () => ({ newId: vi.fn(() => 'new-id') }));

import { getUserById, getUserByUsername } from './users';

const ROW = {
  id: 'u1',
  username: 'editor',
  passwordHash: 'hash',
  displayName: null,
  sessionVersion: 1,
  createdAt: 1,
  role: 'officer',
  status: 'approved',
};

function fakeDb(row: Record<string, unknown> | null) {
  const statements: string[] = [];
  const db = {
    prepare(sql: string) {
      statements.push(sql);
      return { bind: () => ({ first: async () => row }) };
    },
  } as unknown as D1Database;
  return { db, statements };
}

describe('user rows', () => {
  it('selects the role, status and executive columns', async () => {
    const { db, statements } = fakeDb({ ...ROW, isExecutive: 0 });
    await getUserById(db, 'u1');
    expect(statements[0]).toContain('role');
    expect(statements[0]).toContain('status');
    expect(statements[0]).toContain('is_executive as isExecutive');
    expect(statements[0]).toContain('can_access_directors_forum as canAccessDirectorsForum');
  });

  it('maps the stored 0/1 executive flag to a boolean', async () => {
    const on = await getUserById(fakeDb({ ...ROW, isExecutive: 1 }).db, 'u1');
    const off = await getUserByUsername(fakeDb({ ...ROW, isExecutive: 0 }).db, 'editor');
    expect(on?.isExecutive).toBe(true);
    expect(off?.isExecutive).toBe(false);
  });

  it('returns null when no row matches', async () => {
    expect(await getUserById(fakeDb(null).db, 'missing')).toBeNull();
    expect(await getUserByUsername(fakeDb(null).db, 'missing')).toBeNull();
  });

  it('maps special access from SQLite without implicitly granting an officer role', async () => {
    const user = await getUserById(
      fakeDb({ ...ROW, role: 'member', isExecutive: 0, canAccessDirectorsForum: 1 }).db,
      'u1',
    );
    expect(user?.role).toBe('member');
    expect(user?.canAccessDirectorsForum).toBe(true);
    expect(user?.isExecutive).toBe(false);
  });
});
