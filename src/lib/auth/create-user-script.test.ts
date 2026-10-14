// scripts/create-user.mjs 의 입력 검증을 실제로 실행해서 확인한다. 검증은 D1 에 닿기 전에 끝나므로
// 이 테스트는 어떤 데이터베이스도 건드리지 않는다.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const SCRIPT = new URL('../../../scripts/create-user.mjs', import.meta.url).pathname;

function run(args: string[], env: Record<string, string> = {}) {
  const base = { ...process.env };
  delete base.TCN_USER_PASSWORD;
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    env: { ...base, ...env },
    input: '',
    encoding: 'utf8',
    timeout: 20_000,
  });
}

describe('scripts/create-user.mjs input handling', () => {
  it('refuses a password given as an argument and says where to put it instead', () => {
    const result = run(['someone', 'a-legacy-password-arg']);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('TCN_USER_PASSWORD');
  });

  it('refuses a weak password before touching any database', () => {
    const result = run(['someone', '--role', 'member'], { TCN_USER_PASSWORD: 'short' });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/at least 12/);
    expect(result.stdout).not.toContain('created');
  });

  it('refuses a password that contains the username', () => {
    const result = run(['someone', '--role', 'member'], {
      TCN_USER_PASSWORD: 'someone-is-here-1234',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/username/);
  });

  it('checks the role before it asks for a password', () => {
    const result = run(['someone'], { TCN_USER_PASSWORD: 'correct horse battery staple' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--role');
    expect(result.stderr).not.toMatch(/No password provided/);
  });

  it('requires a username', () => {
    const result = run([], { TCN_USER_PASSWORD: 'correct horse battery staple' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('usage');
  });

  it('asks for a password on stdin when no terminal and no variable is available', () => {
    const result = run(['someone', '--role', 'member']);

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/password/i);
  });
});
