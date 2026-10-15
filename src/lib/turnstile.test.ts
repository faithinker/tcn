import { describe, expect, it, vi } from 'vitest';
import { checkTurnstile, parseHostnames, TurnstileError } from './turnstile';

const NOW = new Date('2026-07-29T00:04:00.000Z').getTime();
const VALID = {
  success: true,
  hostname: 'tcn.example',
  action: 'admin_login',
  challenge_ts: '2026-07-29T00:00:00.000Z',
};

function options(result: unknown = VALID) {
  return {
    secret: 'turnstile-secret',
    hostnames: new Set(['tcn.example']),
    action: 'admin_login',
    now: NOW,
    fetch: vi.fn().mockResolvedValue(Response.json(result)),
  };
}

describe('checkTurnstile', () => {
  it('accepts a token whose hostname, action and age all match', async () => {
    const config = options();

    await expect(checkTurnstile('one-time-token', '203.0.113.10', config)).resolves.toBeUndefined();

    expect(config.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) }),
    );
    const body = String((config.fetch.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain('response=one-time-token');
    expect(body).toContain('remoteip=203.0.113.10');
    expect(body).toContain('idempotency_key=');
  });

  it('omits remoteip when the caller has none', async () => {
    const config = options();
    await checkTurnstile('token', null, config);
    expect(String((config.fetch.mock.calls[0][1] as RequestInit).body)).not.toContain('remoteip');
  });

  it.each([
    ['unsuccessful', { ...VALID, success: false }],
    ['another hostname', { ...VALID, hostname: 'evil.example' }],
    ['another action', { ...VALID, action: 'qna_question' }],
    ['an expired challenge', { ...VALID, challenge_ts: '2026-07-28T23:58:00.000Z' }],
    ['a challenge from the future', { ...VALID, challenge_ts: '2026-07-29T00:10:00.000Z' }],
    ['no challenge time', { ...VALID, challenge_ts: undefined }],
  ])('rejects %s', async (_label, result) => {
    await expect(checkTurnstile('token', null, options(result))).rejects.toMatchObject({
      code: 'turnstile_failed',
      status: 403,
    });
  });

  it('fails closed on a network error, a timeout or a non-success HTTP status', async () => {
    const network = options();
    network.fetch.mockRejectedValue(new TypeError('network down'));
    const timeout = options();
    timeout.fetch.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    const badGateway = options();
    badGateway.fetch.mockResolvedValue(new Response(null, { status: 502 }));

    for (const config of [network, timeout, badGateway]) {
      await expect(checkTurnstile('token', null, config)).rejects.toMatchObject({
        code: 'turnstile_failed',
        status: 403,
      });
    }
  });

  it('rejects a missing or oversized token without calling Siteverify', async () => {
    const config = options();

    await expect(checkTurnstile('', null, config)).rejects.toBeInstanceOf(TurnstileError);
    await expect(checkTurnstile('x'.repeat(2_049), null, config)).rejects.toMatchObject({
      code: 'turnstile_failed',
    });
    expect(config.fetch).not.toHaveBeenCalled();
  });

  it('reports a missing secret or hostname list as a configuration failure', async () => {
    const config = options();

    await expect(checkTurnstile('token', null, { ...config, secret: '' })).rejects.toMatchObject({
      code: 'security_not_configured',
      status: 503,
    });
    await expect(
      checkTurnstile('token', null, { ...config, hostnames: new Set() }),
    ).rejects.toMatchObject({ code: 'security_not_configured', status: 503 });
    expect(config.fetch).not.toHaveBeenCalled();
  });
});

describe('parseHostnames', () => {
  it('splits, trims and drops empty entries', () => {
    expect(parseHostnames(' thetcn.org , ,tcn.example,')).toEqual(
      new Set(['thetcn.org', 'tcn.example']),
    );
  });

  it('returns an empty set when nothing is configured', () => {
    expect(parseHostnames(undefined)).toEqual(new Set());
    expect(parseHostnames('')).toEqual(new Set());
  });
});
