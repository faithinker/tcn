import { beforeEach, describe, expect, it, vi } from 'vitest';
const { flags } = vi.hoisted(() => ({ flags: {} as Record<string, string | undefined> }));
vi.mock('cloudflare:workers', () => ({ env: flags }));
import { memberFeaturesEnabled, signupEnabled, memberFeatureUnavailable } from './member-features';
describe('member feature gates', () => {
  beforeEach(() => {
    for (const key of Object.keys(flags)) delete flags[key];
  });
  it.each([undefined, '', 'false', '1', 'TRUE'])('fails closed for %s', (value) => {
    flags.MEMBER_FEATURES_ENABLED = value;
    flags.SIGNUP_ENABLED = value;
    expect(memberFeaturesEnabled()).toBe(false);
    expect(signupEnabled()).toBe(false);
  });
  it('opens only explicit true flags independently', () => {
    flags.MEMBER_FEATURES_ENABLED = 'true';
    expect(memberFeaturesEnabled()).toBe(true);
    expect(signupEnabled()).toBe(false);
    flags.SIGNUP_ENABLED = 'true';
    expect(signupEnabled()).toBe(true);
  });
  it('returns a private, uncacheable unavailable response', () => {
    const response = memberFeatureUnavailable();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });
});
