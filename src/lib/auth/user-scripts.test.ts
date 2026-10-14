import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function run(script: string, args: string[]) {
  const base = { ...process.env };
  delete base.TCN_USER_PASSWORD;
  const result = spawnSync(process.execPath, [join(ROOT, 'scripts', script), ...args], {
    cwd: ROOT,
    // 비밀번호는 인자가 아니라 환경변수로만 받는다. dry-run 은 이 값을 읽지 않으므로 출력에 나오면 새는 것이다.
    env: { ...base, TCN_USER_PASSWORD: 'password-1234' },
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('create-user.mjs', () => {
  it('refuses to run without --role and prints no SQL', () => {
    const result = run('create-user.mjs', ['a@example.org', '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--role');
    expect(result.stdout).not.toContain('insert into');
  });

  it.each([
    [['--role', 'admin'], '--role'],
    [['--role', 'member', '--executive'], '--executive'],
  ])('rejects %j', (flags, mentioned) => {
    const result = run('create-user.mjs', ['a@example.org', ...flags, '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(mentioned);
    expect(result.stdout).not.toContain('insert into');
  });

  it.each([
    [['--role', 'member'], "'member', 'approved', 0"],
    [['--role', 'officer'], "'officer', 'approved', 0"],
    [['--role', 'officer', '--executive'], "'officer', 'approved', 1"],
  ])('inserts an approved account for %j', (flags, values) => {
    const result = run('create-user.mjs', ['a@example.org', ...flags, '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('insert into users');
    expect(result.stdout).toContain(values);
  });

  it('never prints the password or its hash in a dry run', () => {
    const result = run('create-user.mjs', ['a@example.org', '--role', 'member', '--dry-run']);
    expect(result.stdout).not.toContain('password-1234');
    expect(result.stdout).not.toContain('pbkdf2$');
  });

  it('escapes single quotes in the display name', () => {
    const result = run('create-user.mjs', [
      'a@example.org',
      '--role',
      'member',
      '--display',
      "O'Neil",
      '--dry-run',
    ]);
    expect(result.stdout).toContain("'O''Neil'");
  });
});

describe('set-user-role.mjs', () => {
  it('refuses to run without --role', () => {
    const result = run('set-user-role.mjs', ['someone', '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--role');
    expect(result.stdout).not.toContain('update users');
  });

  it('refuses --executive for a member', () => {
    const result = run('set-user-role.mjs', [
      'someone',
      '--role',
      'member',
      '--executive',
      '--dry-run',
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--executive');
    expect(result.stdout).not.toContain('update users');
  });

  it('turns the executive flag off unless --executive is given, and only touches approved officers', () => {
    const officer = run('set-user-role.mjs', ['someone', '--role', 'officer', '--dry-run']);
    expect(officer.status).toBe(0);
    expect(officer.stdout).toContain(
      "update users set role = 'officer', is_executive = 0 where username = 'someone' and status = 'approved';",
    );

    const executive = run('set-user-role.mjs', [
      'someone',
      '--role',
      'officer',
      '--executive',
      '--dry-run',
    ]);
    expect(executive.stdout).toContain(
      "is_executive = 1 where username = 'someone' and status = 'approved'",
    );
  });

  it('demotes to member and clears the executive flag without an approval condition', () => {
    const result = run('set-user-role.mjs', ['someone', '--role', 'member', '--dry-run']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "update users set role = 'member', is_executive = 0 where username = 'someone';",
    );
  });

  it('re-reads the account after the update so a missed row is never reported as success', () => {
    const result = run('set-user-role.mjs', ['someone', '--role', 'officer', '--dry-run']);
    expect(result.stdout).toContain(
      "select role, status, is_executive from users where username = 'someone';",
    );
  });
});
