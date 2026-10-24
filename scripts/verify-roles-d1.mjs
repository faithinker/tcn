import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const state = mkdtempSync(join(tmpdir(), 'tcn-roles-d1-'));
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler');
const ROLES_MIGRATION = '0008_user_roles.sql';

function run(args, { expectFailure = false } = {}) {
  const result = spawnSync(wrangler, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });
  if (expectFailure) {
    assert.notEqual(
      result.status,
      0,
      `Expected command to fail:\n${result.stdout}\n${result.stderr}`,
    );
  } else {
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function execute(sql, options) {
  return run(
    ['d1', 'execute', 'tcn-content', '--local', '--persist-to', state, '--command', sql, '--json'],
    options,
  );
}

function executeFile(file) {
  return run([
    'd1',
    'execute',
    'tcn-content',
    '--local',
    '--persist-to',
    state,
    '--file',
    join('migrations', file),
  ]);
}

const rows = (sql) => JSON.parse(execute(sql))[0].results;

try {
  const migrations = readdirSync('migrations')
    .filter((file) => file.endsWith('.sql'))
    .sort();
  assert.ok(migrations.includes(ROLES_MIGRATION), `${ROLES_MIGRATION} is missing`);

  // 0008 이전 스키마에서 수동 발급 계정을 만든 뒤 0008 을 적용한다. 이전 결과를 검증하려면
  // 역할 컬럼이 없던 시점의 행이 필요하다.
  for (const file of migrations.filter((name) => name < ROLES_MIGRATION)) executeFile(file);
  execute(
    `insert into users (id, username, password_hash, display_name) values
       ('legacy-1', 'editor', 'hash', 'Editor'),
       ('legacy-2', 'admin', 'hash', null)`,
  );
  executeFile(ROLES_MIGRATION);

  const migrated = {
    role: 'officer',
    status: 'approved',
    is_executive: 0,
    revision: 1,
    decided_by: null,
    decided_at: null,
    affiliation: null,
  };
  assert.deepEqual(
    rows(
      `select username, role, status, is_executive, revision, decided_by, decided_at, affiliation
       from users order by username`,
    ),
    [
      { username: 'admin', ...migrated },
      { username: 'editor', ...migrated },
    ],
  );

  // 마이그레이션 뒤에 만든 행은 가장 낮은 권한이 기본값이다.
  execute(`insert into users (id, username, password_hash) values ('new-1', 'new-user', 'hash')`);
  assert.deepEqual(
    rows(`select role, status, is_executive, revision from users where id = 'new-1'`),
    [{ role: 'member', status: 'pending', is_executive: 0, revision: 1 }],
  );

  for (const sql of [
    `update users set role = 'admin' where id = 'new-1'`,
    `update users set status = 'banned' where id = 'new-1'`,
    `update users set is_executive = 2 where id = 'new-1'`,
    `update users set revision = 0 where id = 'new-1'`,
    `update users set decided_by = 'missing-user' where id = 'new-1'`,
  ]) {
    execute(sql, { expectFailure: true });
  }

  execute(
    `update users set status = 'approved', decided_by = 'legacy-1', decided_at = 1760000000,
       revision = 2 where id = 'new-1'`,
  );
  assert.deepEqual(rows(`select status, decided_by, revision from users where id = 'new-1'`), [
    { status: 'approved', decided_by: 'legacy-1', revision: 2 },
  ]);

  const integrity = JSON.parse(execute('pragma foreign_key_check'));
  assert.equal(integrity[0].results.length, 0);
  console.log('PASS: user role migration (backfill, defaults, constraints)');
} finally {
  rmSync(state, { recursive: true, force: true });
}
