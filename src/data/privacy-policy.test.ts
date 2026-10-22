import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEVICE_COOKIE, DEVICE_TTL_SECONDS } from '../lib/auth/device';
import { ACCESS_LOG_RETENTION_MONTHS } from '../lib/users/access-log';
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

  it('states the access-log retention the code enforces, wherever the policy mentions it', () => {
    const months = `${ACCESS_LOG_RETENTION_MONTHS}개월`;
    const row = policy.split('\n').find((line) => line.startsWith('| 관리자 화면 접속기록'));
    expect(row).toContain(`| ${months}.`);
    expect(policy).toContain(`TCN은 ${months} 보관합니다`);
    expect(policy).toContain(`을 남기고 ${months} 보관합니다`);
    expect(policy).toContain(`${months}이 지난 기록은 새 접속기록을 저장할 때 함께 삭제합니다`);
    // No other month count may be attached to the access log.
    const others = [...policy.matchAll(/(\d+)개월/g)].map((match) => match[1]);
    expect(new Set(others)).toEqual(new Set([String(ACCESS_LOG_RETENTION_MONTHS)]));
  });
});
