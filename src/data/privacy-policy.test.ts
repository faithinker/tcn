import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEVICE_COOKIE, DEVICE_TTL_SECONDS } from '../lib/auth/device';
import { SESSION_COOKIE } from '../lib/auth/cookie';
import { SESSION_TTL_SECONDS } from '../lib/auth/session';

const policy = readFileSync(new URL('./privacy-policy.ko.md', import.meta.url), 'utf8');

describe('privacy policy text', () => {
  it('carries no draft markers into the public page', () => {
    expect(policy).not.toContain('【');
  });

  it('has the 18 numbered chapters in order', () => {
    const chapters = [...policy.matchAll(/^## (\d+)\. /gm)].map((match) => Number(match[1]));
    expect(chapters).toEqual(Array.from({ length: 18 }, (_, index) => index + 1));
  });

  it('names the cookies the code sets, with the lifetimes the code uses', () => {
    expect(policy).toContain(`\`${SESSION_COOKIE}\``);
    expect(policy).toContain(`\`${DEVICE_COOKIE}\``);
    expect(policy).toContain('`tcn_signup`');
    expect(policy).toContain(`${SESSION_TTL_SECONDS / 3600}시간 동안 유지`);
    expect(policy).toContain(`${DEVICE_TTL_SECONDS / 86400}일 동안 유지`);
  });
});
