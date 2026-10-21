import { describe, expect, it, vi } from 'vitest';
import { LOGIN_CHALLENGE_ACTION } from '../auth/login-challenge';
import { TurnstileError } from '../turnstile';
import {
  requireResetChallenge,
  requireSignupChallenge,
  RESET_CHALLENGE_ACTION,
  SIGNUP_CHALLENGE_ACTION,
} from './account-challenge';

const NOW = new Date('2026-10-21T00:04:00.000Z').getTime();
const PRODUCTION = new URL('https://thetcn.org/api/auth/signup/start');
const LOCAL = new URL('http://localhost:4321/api/auth/signup/start');

const configured = {
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  QNA_TURNSTILE_HOSTNAMES: 'thetcn.org,tcn.faithinker12.workers.dev',
};

function siteverify(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue(
    Response.json({
      success: true,
      hostname: 'thetcn.org',
      action: SIGNUP_CHALLENGE_ACTION,
      challenge_ts: '2026-10-21T00:00:00.000Z',
      ...overrides,
    }),
  );
}

describe('requireSignupChallenge', () => {
  it('uses an action of its own so login and Q&A tokens cannot start a signup', () => {
    expect(SIGNUP_CHALLENGE_ACTION).toBe('signup_start');
    expect(SIGNUP_CHALLENGE_ACTION).not.toBe(LOGIN_CHALLENGE_ACTION);
  });

  it('accepts a token issued for the signup action on an allowed host', async () => {
    const fetchSpy = siteverify();

    await expect(
      requireSignupChallenge({
        token: 'token',
        remoteIp: '203.0.113.10',
        url: PRODUCTION,
        bindings: configured,
        fetch: fetchSpy,
        now: NOW,
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it.each([LOGIN_CHALLENGE_ACTION, 'qna_question'])(
    'rejects a token that was issued for the %s action',
    async (action) => {
      await expect(
        requireSignupChallenge({
          token: 'token',
          remoteIp: null,
          url: PRODUCTION,
          bindings: configured,
          fetch: siteverify({ action }),
          now: NOW,
        }),
      ).rejects.toMatchObject({ code: 'turnstile_failed', status: 403 });
    },
  );

  it('rejects a missing token without calling Siteverify', async () => {
    const fetchSpy = siteverify();

    await expect(
      requireSignupChallenge({
        token: '',
        remoteIp: null,
        url: PRODUCTION,
        bindings: configured,
        fetch: fetchSpy,
      }),
    ).rejects.toBeInstanceOf(TurnstileError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed with a configuration error when the secret or hosts are not set', async () => {
    for (const bindings of [
      {},
      { TURNSTILE_SECRET_KEY: 'x' },
      { QNA_TURNSTILE_HOSTNAMES: 'a.b' },
    ]) {
      await expect(
        requireSignupChallenge({
          token: 'token',
          remoteIp: null,
          url: PRODUCTION,
          bindings,
          fetch: siteverify(),
        }),
      ).rejects.toMatchObject({ code: 'security_not_configured', status: 503 });
    }
  });

  it('skips Siteverify only for the local off switch', async () => {
    const fetchSpy = siteverify();

    await expect(
      requireSignupChallenge({
        token: '',
        remoteIp: null,
        url: LOCAL,
        bindings: { LOGIN_CHALLENGE: 'off' },
        fetch: fetchSpy,
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not let a stray off flag weaken a production request', async () => {
    await expect(
      requireSignupChallenge({
        token: '',
        remoteIp: null,
        url: PRODUCTION,
        bindings: { ...configured, LOGIN_CHALLENGE: 'off' },
        fetch: siteverify(),
      }),
    ).rejects.toMatchObject({ code: 'turnstile_failed' });
  });
});

describe('requireResetChallenge', () => {
  const resetUrl = new URL('https://thetcn.org/api/auth/forgot-password');

  it('uses an action of its own so signup, login and Q&A tokens cannot request a reset', () => {
    expect(RESET_CHALLENGE_ACTION).toBe('password_reset');
    expect(
      new Set([RESET_CHALLENGE_ACTION, SIGNUP_CHALLENGE_ACTION, LOGIN_CHALLENGE_ACTION]).size,
    ).toBe(3);
  });

  it('accepts a token issued for the reset action on an allowed host', async () => {
    const fetchSpy = siteverify({ action: RESET_CHALLENGE_ACTION });

    await expect(
      requireResetChallenge({
        token: 'token',
        remoteIp: '203.0.113.10',
        url: resetUrl,
        bindings: configured,
        fetch: fetchSpy,
        now: NOW,
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it.each([SIGNUP_CHALLENGE_ACTION, LOGIN_CHALLENGE_ACTION, 'qna_question'])(
    'rejects a token that was issued for the %s action',
    async (action) => {
      await expect(
        requireResetChallenge({
          token: 'token',
          remoteIp: null,
          url: resetUrl,
          bindings: configured,
          fetch: siteverify({ action }),
          now: NOW,
        }),
      ).rejects.toMatchObject({ code: 'turnstile_failed', status: 403 });
    },
  );

  it('does not let a reset token start a signup', async () => {
    await expect(
      requireSignupChallenge({
        token: 'token',
        remoteIp: null,
        url: PRODUCTION,
        bindings: configured,
        fetch: siteverify({ action: RESET_CHALLENGE_ACTION }),
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'turnstile_failed' });
  });

  it('rejects a missing token, fails closed without keys and honours only the local off switch', async () => {
    const fetchSpy = siteverify({ action: RESET_CHALLENGE_ACTION });
    await expect(
      requireResetChallenge({
        token: '',
        remoteIp: null,
        url: resetUrl,
        bindings: configured,
        fetch: fetchSpy,
      }),
    ).rejects.toMatchObject({ code: 'turnstile_failed' });
    await expect(
      requireResetChallenge({
        token: 'token',
        remoteIp: null,
        url: resetUrl,
        bindings: {},
        fetch: fetchSpy,
      }),
    ).rejects.toMatchObject({ code: 'security_not_configured', status: 503 });
    await expect(
      requireResetChallenge({
        token: '',
        remoteIp: null,
        url: resetUrl,
        bindings: { ...configured, LOGIN_CHALLENGE: 'off' },
        fetch: fetchSpy,
      }),
    ).rejects.toMatchObject({ code: 'turnstile_failed' });
    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(
      requireResetChallenge({
        token: '',
        remoteIp: null,
        url: new URL('http://localhost:4321/api/auth/forgot-password'),
        bindings: { LOGIN_CHALLENGE: 'off' },
        fetch: fetchSpy,
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
