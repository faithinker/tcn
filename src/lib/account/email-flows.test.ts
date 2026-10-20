import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('cloudflare:workers', () => ({ env: {} }));
import { openTestD1, type TestD1 } from '../../test-support/d1';
import {
  beginSignup,
  verifySignup,
  finishSignup,
  signupState,
  requestPasswordReset,
  finishPasswordReset,
} from './email-flows';
import { getUserByUsername } from '../db/users';
import { verifyPassword } from '../auth/password';
let h: TestD1;
const url = new URL('http://localhost:4345/signup');
const bindings = { AUTH_MAIL_MODE: 'local' };
const secret = 'mail-test-secret';
const request = () => new Request(url, { headers: { 'cf-connecting-ip': '192.0.2.1' } });
async function latestMail() {
  return (await h.db
    .prepare('SELECT body FROM auth_local_mail ORDER BY created_at DESC,rowid DESC LIMIT 1')
    .first<{ body: string }>())!.body;
}
const input = {
  email: 'new@example.org',
  password: 'A quiet phrase beside the river',
  passwordConfirmation: 'A quiet phrase beside the river',
  displayName: 'Researcher',
};
beforeEach(async () => {
  h = await openTestD1();
});
afterEach(() => h.dispose());
async function verified() {
  const proof = await beginSignup(h.db, input.email, request(), bindings, secret);
  const code = (await latestMail()).match(/\b\d{6}\b/)![0];
  await verifySignup(h.db, proof, code, secret);
  return proof;
}
it('requires mailbox verification bound to the initiating browser', async () => {
  const proof = await beginSignup(h.db, input.email, request(), bindings, secret);
  expect(await getUserByUsername(h.db, input.email)).toBeNull();
  await expect(finishSignup(h.db, proof, input)).rejects.toMatchObject({
    code: 'verification_required',
  });
  const code = (await latestMail()).match(/\b\d{6}\b/)![0];
  await expect(verifySignup(h.db, proof + 'tampered', code, secret)).rejects.toMatchObject({
    code: 'verification_required',
  });
  await verifySignup(h.db, proof, code, secret);
  expect(await signupState(h.db, proof)).toMatchObject({ email: input.email, verified: true });
  const id = await finishSignup(h.db, proof, input);
  expect(await getUserByUsername(h.db, input.email)).toMatchObject({
    id,
    role: 'member',
    status: 'pending',
    isExecutive: false,
  });
  await expect(finishSignup(h.db, proof, input)).rejects.toMatchObject({
    code: 'verification_required',
  });
});
it('never accepts client email replacement or unverified=true claims', async () => {
  const proof = await verified();
  await expect(
    finishSignup(h.db, proof, { ...input, email: 'other@example.org' }),
  ).rejects.toMatchObject({ code: 'verification_required' });
  expect(await getUserByUsername(h.db, 'other@example.org')).toBeNull();
});
it('expires proof, limits wrong codes and rate limits repeat mail', async () => {
  const proof = await beginSignup(h.db, input.email, request(), bindings, secret);
  await expect(beginSignup(h.db, input.email, request(), bindings, secret)).rejects.toMatchObject({
    status: 429,
  });
  for (let i = 0; i < 5; i++)
    await expect(verifySignup(h.db, proof, 'incorrect', secret)).rejects.toMatchObject({
      code: 'invalid_code',
    });
  const code = (await latestMail()).match(/\b\d{6}\b/)![0];
  await expect(verifySignup(h.db, proof, code, secret)).rejects.toMatchObject({
    code: 'verification_required',
  });
  await h.db.prepare('UPDATE auth_email_challenges SET expires_at=0').run();
  expect(await signupState(h.db, proof)).toBeNull();
});
it('resets only an authenticated mailbox using one-time links and revokes all sessions', async () => {
  const proof = await verified();
  await finishSignup(h.db, proof, input);
  await requestPasswordReset(h.db, input.email, request(), bindings, secret);
  const token = new URL((await latestMail()).match(/http[^\s]+/)![0]).searchParams.get('token')!;
  // Reading a link does not consume it: only the final POST performs any mutation.
  const before = (await getUserByUsername(h.db, input.email))!;
  expect(before.sessionVersion).toBe(1);
  await finishPasswordReset(
    h.db,
    token,
    'A new phrase beside the river',
    'A new phrase beside the river',
  );
  const after = (await getUserByUsername(h.db, input.email))!;
  expect(after.sessionVersion).toBe(2);
  expect(await verifyPassword('A new phrase beside the river', after.passwordHash)).toBe(true);
  await expect(
    finishPasswordReset(
      h.db,
      token,
      'Another phrase beside the river',
      'Another phrase beside the river',
    ),
  ).rejects.toMatchObject({ code: 'invalid_reset_link' });
});
it('does not provide reset links for missing or unverified legacy accounts', async () => {
  await h.db
    .prepare(
      "INSERT INTO users(id,username,password_hash) VALUES ('legacy','legacy@example.org','!')",
    )
    .run();
  await requestPasswordReset(h.db, 'legacy@example.org', request(), bindings, secret);
  await requestPasswordReset(h.db, 'absent@example.org', request(), bindings, secret);
  expect((await h.db.prepare('SELECT * FROM auth_local_mail').all()).results).toHaveLength(0);
});
it('fails closed for production local-mode and unconfigured email sending', async () => {
  const remote = new Request('https://tcn.example/signup');
  await expect(beginSignup(h.db, input.email, remote, bindings, secret)).rejects.toMatchObject({
    code: 'email_unavailable',
    status: 503,
  });
  expect((await h.db.prepare('SELECT * FROM auth_local_mail').all()).results).toHaveLength(0);
});
it('acknowledges reset without waiting for a provider or revealing account lookup timing', async () => {
  const proof = await verified();
  await finishSignup(h.db, proof, input);
  const tasks: Promise<void>[] = [];
  const network = vi.fn(async () => Response.json({ id: 'mail' }));
  vi.stubGlobal('fetch', network);
  try {
    await requestPasswordReset(
      h.db,
      input.email,
      new Request('https://tcn.example/forgot-password'),
      {
        AUTH_PUBLIC_ORIGIN: 'https://tcn.example',
        AUTH_MAIL_FROM: 'accounts@tcn.example',
        RESEND_API_KEY: 'test',
      },
      secret,
      (task) => tasks.push(task),
    );
    expect(tasks).toHaveLength(1);
    await Promise.all(tasks);
  } finally {
    vi.unstubAllGlobals();
  }
});
it('keeps password reset working when the daily signup verification budget is exhausted', async () => {
  const proof = await verified();
  await finishSignup(h.db, proof, input);
  const date = new Date().toISOString().slice(0, 10);
  await h.db
    .prepare('INSERT INTO auth_mail_limits(key,attempts,started_at,last_sent_at) VALUES (?,50,0,1)')
    .bind('send-budget:' + date)
    .run();
  const network = vi.fn(async () => Response.json({ id: 'mail' }));
  vi.stubGlobal('fetch', network);
  const prodBindings = {
    AUTH_PUBLIC_ORIGIN: 'https://tcn.example',
    AUTH_MAIL_FROM: 'accounts@tcn.example',
    RESEND_API_KEY: 'test',
  };
  try {
    await expect(
      beginSignup(
        h.db,
        'another@example.org',
        new Request('https://tcn.example/signup', {
          headers: { 'cf-connecting-ip': '192.0.2.99' },
        }),
        prodBindings,
        secret,
      ),
    ).rejects.toMatchObject({ code: 'email_unavailable', status: 503 });
    expect(network).not.toHaveBeenCalled();

    await requestPasswordReset(
      h.db,
      input.email,
      new Request('https://tcn.example/forgot-password', {
        headers: { 'cf-connecting-ip': '192.0.2.100' },
      }),
      prodBindings,
      secret,
    );
    expect(network).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
