#!/usr/bin/env node
// 계정의 역할과 결정권(회장·부회장) 변경. 화면에서는 임원 역할과 결정권을 줄 수 없으므로
// (명세서 4.3) 운영자가 이 스크립트로만 바꾼다.
//
// 사용법:
//   node scripts/set-user-role.mjs <username> --role officer|member [--executive] [--remote] [--dry-run]
//
//   --role       필수. 결과 상태가 인자로 완전히 정해진다. 생략한 값을 현재 값으로 두지 않는다.
//   --executive  결정권. --role officer 와 함께일 때만 허용한다. 생략하면 결정권이 꺼진다.
//   --remote     원격(운영) D1. 없으면 로컬(.wrangler) D1.
//   --dry-run    실행하지 않고 SQL 만 출력한다. 운영 DB 에 쓰기 전에 먼저 확인한다.
//
// officer 는 status 가 approved 인 계정에만 줄 수 있다(임원 권한은 승인된 계정에서만 유효, 명세서 4.1).
// 실행 뒤 같은 계정을 다시 읽어 기대한 값이 되었는지 확인한다. 계정이 없거나 승인되지 않았으면
// 오류로 끝난다. 역할은 요청마다 D1 에서 읽으므로 세션을 폐기할 필요가 없다.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// PATH 조회를 거치지 않도록 저장소 안의 실행 파일을 직접 가리킨다(create-user.mjs 와 같은 이유).
const WRANGLER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '.bin',
  'wrangler',
);

const USAGE =
  'usage: node scripts/set-user-role.mjs <username> --role officer|member [--executive] [--remote] [--dry-run]';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const parsed = { remote: false, dryRun: false, executive: false, role: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--remote') parsed.remote = true;
    else if (argv[i] === '--dry-run') parsed.dryRun = true;
    else if (argv[i] === '--executive') parsed.executive = true;
    else if (argv[i] === '--role') parsed.role = argv[(i += 1)] ?? null;
    else positional.push(argv[i]);
  }
  return { username: positional[0], ...parsed };
}

const { username, role, executive, remote, dryRun } = parseArgs(process.argv.slice(2));
if (!username) fail(USAGE);
if (role !== 'officer' && role !== 'member') fail(`--role officer|member is required\n${USAGE}`);
if (executive && role !== 'officer') fail('--executive is only allowed with --role officer');

const sqlLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;
const isExecutive = executive ? 1 : 0;
const approvedOnly = role === 'officer' ? " and status = 'approved'" : '';
const update =
  `update users set role = ${sqlLiteral(role)}, is_executive = ${isExecutive} ` +
  `where username = ${sqlLiteral(username)}${approvedOnly};`;
const verify = `select role, status, is_executive from users where username = ${sqlLiteral(username)};`;
const sql = `${update} ${verify}`;

if (dryRun) {
  console.log(sql);
  process.exit(0);
}

const target = remote ? '--remote' : '--local';
let row;
try {
  const output = execFileSync(
    WRANGLER,
    ['d1', 'execute', 'tcn-content', target, '--command', sql, '--json'],
    { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] },
  );
  row = JSON.parse(output).at(-1)?.results?.[0];
} catch {
  fail(
    `❌ could not confirm the update for '${username}'. The change may or may not have applied; ` +
      `check with: select role, status, is_executive from users where username = '${username}'`,
  );
}

if (!row) fail(`❌ user '${username}' not found`);
const applied =
  row.role === role &&
  row.is_executive === isExecutive &&
  (role === 'member' || row.status === 'approved');
if (!applied) {
  fail(
    `❌ '${username}' was not updated (role=${row.role}, status=${row.status}, executive=${row.is_executive}). ` +
      'An officer role needs an approved account.',
  );
}
console.log(
  `✅ ${username}: role=${row.role} status=${row.status} executive=${row.is_executive} ` +
    `on ${remote ? 'remote' : 'local'} D1`,
);
