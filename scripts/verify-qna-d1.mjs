import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const state = mkdtempSync(join(tmpdir(), 'tcn-qna-d1-'));
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler');
const overlongTitle = 'x'.repeat(121);

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

try {
  run(['d1', 'migrations', 'apply', 'tcn-content', '--local', '--persist-to', state]);

  const schema = JSON.parse(
    execute(
      `select name, type from sqlite_master
       where name in (
         'qna_questions', 'qna_answers', 'qna_audit_events',
         'qna_rate_limits', 'qna_turnstile_tokens',
         'qna_visible_created', 'qna_answer_question'
       )
       order by name`,
    ),
  );
  const names = schema[0].results.map((row) => row.name);
  assert.deepEqual(names, [
    'qna_answer_question',
    'qna_answers',
    'qna_audit_events',
    'qna_questions',
    'qna_rate_limits',
    'qna_turnstile_tokens',
    'qna_visible_created',
  ]);

  execute(
    `insert into users (id, username, password_hash) values ('admin-1', 'admin', 'hash');
     insert into qna_questions (id, title, body, asker_user_id)
     values ('q-1', 'Question', 'Body', 'admin-1');
     insert into qna_answers (question_id, body, answered_by)
     values ('q-1', 'Answer', 'admin-1');`,
  );

  execute(
    `insert into qna_answers (question_id, body, answered_by)
     values ('q-1', 'Second answer', 'admin-1')`,
    { expectFailure: true },
  );
  execute(`insert into qna_questions (id, title, body) values ('q-space', '   ', 'Body')`, {
    expectFailure: true,
  });
  execute(`insert into qna_questions (id, title, body) values ('q-nul', 'Title', char(0))`, {
    expectFailure: true,
  });
  execute(
    `insert into qna_questions (id, title, body) values ('q-long', '${overlongTitle}', 'Body')`,
    { expectFailure: true },
  );
  execute(
    `insert into qna_questions (id, title, body, visibility)
     values ('q-state', 'Title', 'Body', 'deleted')`,
    { expectFailure: true },
  );

  const integrity = JSON.parse(execute('pragma foreign_key_check'));
  assert.equal(integrity[0].results.length, 0);
  console.log('PASS: Q&A local D1 migration and integrity checks (11 assertions)');
} finally {
  rmSync(state, { recursive: true, force: true });
}
