import { describe, expect, it, vi } from 'vitest';
import { TurnstileError } from '../turnstile';
import {
  isLoginChallengeBypassed,
  LOGIN_CHALLENGE_ACTION,
  requireLoginChallenge,
} from './login-challenge';

const NOW = new Date('2026-07-29T00:04:00.000Z').getTime();
const PRODUCTION = new URL('https://thetcn.org/api/auth/login');
const LOCAL = new URL('http://localhost:4321/api/auth/login');

const configured = {
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  QNA_TURNSTILE_HOSTNAMES: 'thetcn.org,tcn.faithinker12.workers.dev',
};

function siteverify(overrides: Record<string, unknown> = {}) {
  return vi.fn().mockResolvedValue(
    Response.json({
      success: true,
      hostname: 'thetcn.org',
      action: LOGIN_CHALLENGE_ACTION,
      challenge_ts: '2026-07-29T00:00:00.000Z',
      ...overrides,
    }),
  );
}

describe('isLoginChallengeBypassed', () => {
  it('bypasses only when the flag is off AND the request is on a local host', () => {
    const off = { LOGIN_CHALLENGE: 'off' };

    expect(isLoginChallengeBypassed(off, LOCAL)).toBe(true);
    expect(isLoginChallengeBypassed(off, new URL('http://127.0.0.1:4321/'))).toBe(true);
    expect(isLoginChallengeBypassed(off, new URL('http://[::1]:4321/'))).toBe(true);
  });

  it('never bypasses on a real host, even if the flag was set there by mistake', () => {
    const off = { LOGIN_CHALLENGE: 'off' };

    expect(isLoginChallengeBypassed(off, PRODUCTION)).toBe(false);
    expect(isLoginChallengeBypassed(off, new URL('https://tcn.faithinker12.workers.dev/'))).toBe(
      false,
    );
    expect(isLoginChallengeBypassed(off, new URL('https://localhost.evil.example/'))).toBe(false);
  });

  it('keeps the challenge on locally unless the flag is exactly off', () => {
    expect(isLoginChallengeBypassed({}, LOCAL)).toBe(false);
    expect(isLoginChallengeBypassed({ LOGIN_CHALLENGE: '' }, LOCAL)).toBe(false);
    expect(isLoginChallengeBypassed({ LOGIN_CHALLENGE: 'false' }, LOCAL)).toBe(false);
    expect(isLoginChallengeBypassed({ LOGIN_CHALLENGE: 'OFF' }, LOCAL)).toBe(false);
  });
});

describe('requireLoginChallenge', () => {
  it('skips Siteverify entirely when bypassed', async () => {
    const fetchSpy = siteverify();

    await expect(
      requireLoginChallenge({
        token: '',
        remoteIp: null,
        url: LOCAL,
        bindings: { LOGIN_CHALLENGE: 'off' },
        fetch: fetchSpy,
      }),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('accepts a token issued for the login action on an allowed host', async () => {
    const fetchSpy = siteverify();

    await expect(
      requireLoginChallenge({
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

  it('rejects a token that was issued for another action such as the Q&A form', async () => {
    await expect(
      requireLoginChallenge({
        token: 'token',
        remoteIp: null,
        url: PRODUCTION,
        bindings: configured,
        fetch: siteverify({ action: 'qna_question' }),
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: 'turnstile_failed', status: 403 });
  });

  it('rejects a missing token without calling Siteverify', async () => {
    const fetchSpy = siteverify();

    await expect(
      requireLoginChallenge({
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
        requireLoginChallenge({
          token: 'token',
          remoteIp: null,
          url: PRODUCTION,
          bindings,
          fetch: siteverify(),
        }),
      ).rejects.toMatchObject({ code: 'security_not_configured', status: 503 });
    }
  });

  it('does not let a stray off flag weaken a production request', async () => {
    await expect(
      requireLoginChallenge({
        token: '',
        remoteIp: null,
        url: PRODUCTION,
        bindings: { ...configured, LOGIN_CHALLENGE: 'off' },
        fetch: siteverify(),
      }),
    ).rejects.toMatchObject({ code: 'turnstile_failed' });
  });
});
