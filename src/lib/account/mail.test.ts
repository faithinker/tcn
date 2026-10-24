import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { openTestD1, type TestD1 } from '../../test-support/d1';
import { approvalNotice, securityNotice, sendAccountMail } from './mail';
let h: TestD1;
const request = new Request('https://tcn.example/signup');
const bindings = {
  RESEND_API_KEY: 'test-key',
  AUTH_MAIL_FROM: 'accounts@tcn.example',
  AUTH_PUBLIC_ORIGIN: 'https://tcn.example',
};
beforeEach(async () => {
  h = await openTestD1();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ id: 'test-mail' })),
  );
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await h.dispose();
});
it('sends Resend JSON only to the configured API with a server-held key', async () => {
  await sendAccountMail(
    h.db,
    request,
    bindings,
    'person@example.org',
    'Verify',
    'Your code is 123456',
  );
  expect(fetch).toHaveBeenCalledWith(
    'https://api.resend.com/emails',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer test-key' }),
    }),
  );
  const init = vi.mocked(fetch).mock.calls[0][1]!;
  expect(JSON.parse(init.body as string)).toMatchObject({
    from: 'Transcultural Network <accounts@tcn.example>',
    to: ['person@example.org'],
    subject: 'Verify',
    text: 'Your code is 123456',
  });
});
it('stops before network sends when the conservative free-tier daily budget is consumed', async () => {
  for (let i = 0; i < 90; i++)
    await sendAccountMail(h.db, request, bindings, 'person@example.org', 'Verify', 'test');
  await expect(
    sendAccountMail(h.db, request, bindings, 'person@example.org', 'Verify', 'test'),
  ).rejects.toMatchObject({ status: 503 });
  expect(fetch).toHaveBeenCalledTimes(90);
});
it('logs a mail_budget_refused event, without the address, when a send is refused for budget', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    for (let i = 0; i < 90; i++)
      await sendAccountMail(h.db, request, bindings, 'person@example.org', 'Verify', 'test');
    await expect(
      sendAccountMail(h.db, request, bindings, 'person@example.org', 'Verify', 'test'),
    ).rejects.toMatchObject({ status: 503 });
    expect(warn).toHaveBeenCalledOnce();
    const logged = String(warn.mock.calls[0][0]);
    expect(JSON.parse(logged)).toEqual({
      event: 'mail_budget_refused',
      category: 'security',
      period: 'day',
    });
    expect(logged).not.toContain('person@example.org');
  } finally {
    warn.mockRestore();
  }
});
it('reserves daily send budget for password recovery and security notices when signup quota is exhausted', async () => {
  for (let i = 0; i < 70; i++) {
    await sendAccountMail(
      h.db,
      request,
      bindings,
      'person@example.org',
      'Verify',
      'test',
      undefined,
      'signup',
    );
  }
  await expect(
    sendAccountMail(
      h.db,
      request,
      bindings,
      'person@example.org',
      'Verify',
      'test',
      undefined,
      'signup',
    ),
  ).rejects.toMatchObject({ code: 'email_unavailable', status: 503 });
  expect(fetch).toHaveBeenCalledTimes(70);

  for (let i = 0; i < 15; i++) {
    await sendAccountMail(
      h.db,
      request,
      bindings,
      'person@example.org',
      'Reset',
      'test',
      undefined,
      'reset',
    );
  }
  await expect(
    sendAccountMail(
      h.db,
      request,
      bindings,
      'person@example.org',
      'Reset',
      'test',
      undefined,
      'reset',
    ),
  ).rejects.toMatchObject({ code: 'email_unavailable', status: 503 });
  expect(fetch).toHaveBeenCalledTimes(85);

  await securityNotice(h.db, request, bindings, 'person@example.org', 'password');
  expect(fetch).toHaveBeenCalledTimes(86);
});
it('returns a generic provider failure without leaking response bodies', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('private provider details', { status: 429 }));
  await expect(
    sendAccountMail(h.db, request, bindings, 'person@example.org', 'Verify', 'test'),
  ).rejects.toMatchObject({ code: 'email_unavailable', status: 503 });
});
it('sends an approval notice email with the login URL', async () => {
  await approvalNotice(h.db, request, bindings, 'approved.member@example.org');
  expect(fetch).toHaveBeenCalledWith(
    'https://api.resend.com/emails',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ authorization: 'Bearer test-key' }),
    }),
  );
  const init = vi.mocked(fetch).mock.calls[0][1]!;
  expect(JSON.parse(init.body as string)).toMatchObject({
    to: ['approved.member@example.org'],
    subject: 'Your TCN membership application has been approved',
    text: expect.stringContaining('https://tcn.example/login'),
  });
});
it('retries approval notice once on transient error and logs on failure without leaking email', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.mocked(fetch).mockRejectedValue(new Error('resend connection failure'));
  try {
    await approvalNotice(h.db, request, bindings, 'failing.member@example.org');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledOnce();
    const logged = String(warn.mock.calls[0][0]);
    expect(JSON.parse(logged)).toEqual({ event: 'account_approval_notice_failed' });
    expect(logged).not.toContain('failing.member@example.org');
  } finally {
    warn.mockRestore();
  }
});
