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

  it.each([
    [['--display', '--dry-run'], '--display'],
    [['--display', '--remote'], '--display'],
    [['--display'], '--display'],
    [['--role', 'member', '--display'], '--display'],
  ])('does not let %j swallow the next flag', (flags, mentioned) => {
    const result = run('create-user.mjs', [
      'a@example.org',
      ...(flags.includes('--role') ? [] : ['--role', 'member']),
      ...flags,
      ...(flags.includes('--dry-run') ? [] : ['--dry-run']),
    ]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(mentioned);
    expect(result.stdout).not.toContain('insert into');
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

describe('audited user operations CLI', () => {
  it('requires an explicit actor or bootstrap', () => {
    const result = run('set-user-role.mjs', ['someone', '--role', 'officer', '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('--actor');
  });

  it('prints an atomic audit plan without touching D1', () => {
    const result = run('set-user-role.mjs', [
      "O'Neil",
      '--role',
      'officer',
      '--actor',
      'president',
      '--request-id',
      'review-123',
      '--dry-run',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("'O''Neil'");
    expect(result.stdout).toContain('revision = revision + 1');
    expect(result.stdout).toContain('can_access_directors_forum = 0');
    expect(result.stdout).toContain('insert into user_audit_events');
    expect(result.stdout).toContain('review-123');
    expect(result.stdout).toContain('is_executive = 0');
  });

  it('requires a reason for exceptional bootstrap and labels the audit exception', () => {
    const args = ['someone', '--role', 'officer', '--executive', '--bootstrap', '--dry-run'];
    expect(run('set-user-role.mjs', args).status).toBe(1);
    const result = run('set-user-role.mjs', [...args, '--reason', 'Initial president']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('BOOTSTRAP/BREAKGLASS');
    expect(result.stdout).toContain('Initial president');
    expect(result.stdout).toContain('is_executive = 1');
    expect(result.stdout).not.toContain('insert into user_audit_events');
  });

  it.each([
    ['--role', 'member', '--executive', '--actor', 'president'],
    ['--role', 'officer', '--actor', 'president', '--bootstrap', '--reason', 'x'],
    ['--role', 'officer', '--actor', 'president', '--unknown'],
    ['--role', 'officer', '--actor', 'president', '--persist-to', '/tmp/x', '--remote'],
    ['--role', 'member', '--role', 'officer', '--actor', 'president'],
    ['--role', 'officer', '--actor', 'president', '--request-id', 'bad'],
  ])('rejects unsafe or ambiguous role flags %j', (...flags) => {
    expect(run('set-user-role.mjs', ['someone', ...flags, '--dry-run']).status).toBe(1);
  });

  it.each(['--allow', '--revoke'])('prints audited forum %s SQL', (flag) => {
    const result = run('set-user-forum-access.mjs', [
      'someone',
      flag,
      '--actor',
      'president',
      '--dry-run',
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("role = 'member'");
    expect(result.stdout).toContain("status = 'approved'");
    expect(result.stdout).toContain('insert into user_audit_events');
    expect(result.stdout).toContain(`can_access_directors_forum = ${flag === '--allow' ? 1 : 0}`);
  });

  it.each([[[]], [['--allow', '--revoke']], [['--allow', '--bootstrap', '--reason', 'x']]])(
    'rejects ambiguous forum access %j',
    (flags) => {
      expect(run('set-user-forum-access.mjs', ['someone', ...flags, '--dry-run']).status).toBe(1);
    },
  );
});
