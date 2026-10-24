import { beforeEach, expect, it, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { afterEach } from 'vitest';
const state = vi.hoisted(() => ({
  enabled: true,
  user: { id: 'actor' },
  security: null as null | { code: string; status: number },
  db: null as D1Database | null,
}));
vi.mock('../member-features', () => ({
  memberFeaturesEnabled: () => state.enabled,
  memberFeatureUnavailable: () => new Response(null, { status: 503 }),
}));
vi.mock('../db', () => ({ getDB: () => state.db }));
vi.mock('../auth/mutation', () => ({
  requireMutation: vi.fn(async () => {
    if (state.security) throw state.security;
    return { user: state.user };
  }),
}));
import { requireMutation } from '../auth/mutation';
import { PATCH as status } from '../../pages/api/users/[id]/status';
import { PATCH as permissions } from '../../pages/api/users/[id]/permissions';
let harness: TestD1;
beforeEach(async () => {
  harness = await openTestD1();
  state.db = harness.db;
  state.enabled = true;
  state.security = null;
  vi.clearAllMocks();
  await harness.db
    .prepare(
      `insert into users(id,username,password_hash,role,status,is_executive) values ('actor','actor','hash','officer','approved',1),('target','target','hash','member','pending',0),('protected','protected','hash','officer','pending',1)`,
    )
    .run();
});
afterEach(async () => harness.dispose());
const payload = { status: 'approved', expectedRevision: 1, requestId: 'route-request-001' };
const call = (route: typeof status, body: unknown, id = 'target') =>
  route({
    request: new Request('https://tcn.test/api/users/' + id + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: { id },
  } as never);
it('gates every users mutation before authentication', async () => {
  state.enabled = false;
  expect((await call(status, payload)).status).toBe(503);
  expect((await call(permissions, payload)).status).toBe(503);
  expect(requireMutation).not.toHaveBeenCalled();
});
it('uses the users CSRF scope and executive requirement and returns audited success', async () => {
  const response = await call(status, payload);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(requireMutation).toHaveBeenCalledWith(expect.any(Request), {
    scope: 'users',
    require: 'executive',
  });
  expect(await response.json()).toMatchObject({
    ok: true,
    user: { status: 'approved', revision: 2 },
  });
});
it('records the connecting IP of the executive on the audit event', async () => {
  const response = await status({
    request: new Request('https://tcn.test/api/users/target/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.20' },
      body: JSON.stringify(payload),
    }),
    params: { id: 'target' },
  } as never);
  expect(response.status).toBe(200);
  expect(
    await harness.db.prepare('select ip from user_audit_events').first<{ ip: string | null }>(),
  ).toEqual({ ip: '203.0.113.20' });
});
it('preserves authentication/Origin/CSRF failures', async () => {
  for (const error of [
    { code: 'unauthorized', status: 401 },
    { code: 'invalid_origin', status: 403 },
    { code: 'invalid_csrf', status: 403 },
  ]) {
    state.security = error;
    expect((await call(status, payload)).status).toBe(error.status);
  }
});
it('blocks the protected executive status bypass and self changes', async () => {
  expect((await call(status, payload, 'protected')).status).toBe(403);
  expect((await call(status, payload, 'actor')).status).toBe(403);
});
it('rejects injected actor fields, malformed revisions and incomplete permissions', async () => {
  expect((await call(status, { ...payload, actorId: 'other' })).status).toBe(400);
  expect((await call(status, { ...payload, expectedRevision: 0 })).status).toBe(400);
  expect(
    (
      await call(permissions, {
        role: 'officer',
        expectedRevision: 1,
        requestId: 'route-invalid-001',
      })
    ).status,
  ).toBe(400);
});
it('returns missing user and revision conflicts without claiming success', async () => {
  expect((await call(status, payload, 'missing')).status).toBe(404);
  expect((await call(status, { ...payload, expectedRevision: 2 })).status).toBe(409);
});
