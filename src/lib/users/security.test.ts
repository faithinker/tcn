import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
const state = vi.hoisted(() => ({
  env: { MEMBER_FEATURES_ENABLED: 'true' },
  db: null as D1Database | null,
  user: null as unknown,
}));
vi.mock('cloudflare:workers', () => ({ env: state.env }));
vi.mock('../db', () => ({ getDB: () => state.db }));
vi.mock('../auth/guard', () => ({
  getSessionUser: async () => state.user,
  getSessionSecret: () => 'users-test-secret',
}));
import { createCsrfToken } from '../auth/mutation';
import { PATCH } from '../../pages/api/users/[id]/status';
let harness: TestD1;
let csrf: string;
const actor = {
  id: 'actor',
  username: 'actor',
  displayName: 'Actor',
  status: 'approved',
  role: 'officer',
  isExecutive: true,
  canAccessDirectorsForum: false,
};
beforeEach(async () => {
  harness = await openTestD1();
  state.db = harness.db;
  state.user = actor;
  await harness.db
    .prepare(
      "insert into users(id,username,password_hash,role,status,is_executive) values ('actor','actor','hash','officer','approved',1),('target','target','hash','member','pending',0)",
    )
    .run();
  csrf = await createCsrfToken('users', 'session', 'users-test-secret');
});
afterEach(async () => harness.dispose());
function call(headers: Record<string, string> = {}) {
  return PATCH({
    request: new Request('https://users.test/api/users/target/status', {
      method: 'PATCH',
      headers: {
        origin: 'https://users.test',
        cookie: 'tcn_session=session',
        'x-csrf-token': csrf,
        ...headers,
      },
      body: JSON.stringify({ status: 'approved', expectedRevision: 1, requestId: 'security-0001' }),
    }),
    params: { id: 'target' },
  } as never);
}
it('accepts actual users-scoped CSRF and rejects forum/qna scope, Origin and cross-site metadata', async () => {
  const cases: Record<string, string>[] = [
    { 'x-csrf-token': '' },
    { origin: 'https://evil.test' },
    { 'sec-fetch-site': 'cross-site' },
    { 'x-csrf-token': await createCsrfToken('forum', 'session', 'users-test-secret') },
    { 'x-csrf-token': await createCsrfToken('qna', 'session', 'users-test-secret') },
  ];
  for (const headers of cases) expect((await call(headers)).status).toBe(403);
  expect((await call()).status).toBe(200);
});
it('blocks anonymous, pending/rejected executives, ordinary officers and special members', async () => {
  state.user = null;
  expect((await call()).status).toBe(401);
  for (const user of [
    { ...actor, status: 'pending' },
    { ...actor, status: 'rejected' },
    { ...actor, isExecutive: false },
    { ...actor, role: 'member', canAccessDirectorsForum: true },
  ]) {
    state.user = user;
    expect((await call()).status).toBe(403);
  }
});
