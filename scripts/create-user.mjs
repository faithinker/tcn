#!/usr/bin/env node
// 계정 수동 발급(회원가입 UI 없음). 비밀번호를 해시해 D1 에 INSERT 한다.
//
// node scripts/create-user.mjs <username> --role officer|member
//   [--executive] [--remote] [--display "표시이름"] [--dry-run]
//   --role       필수. 의도하지 않은 권한 부여를 막으려고 기본값이 없다.
//   --executive  결정권(회장·부회장). --role officer 와 함께일 때만 허용한다.
//   --remote     운영 D1 (없으면 로컬 .wrangler D1)
//   --dry-run    실행하지 않고 SQL 만 출력한다. 비밀번호를 묻지 않고 해시도 만들지 않는다.
//
// 비밀번호는 인자로 받지 않는다(셸 히스토리·프로세스 목록에 남는다). 터미널이면 숨김 입력,
// 아니면 환경변수 TCN_USER_PASSWORD, 그것도 없으면 표준입력 첫 줄. 정책은 src/lib/auth/password-policy.ts.
// 발급된 계정은 status 가 approved 다. 해시 포맷은 src/lib/auth/password.ts 와 같다(pbkdf2$iter$salt$hash).
import { webcrypto as crypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Node 가 `.ts` 를 직접 읽는다(타입 제거). 정책 파일은 지워질 수 있는 문법만 쓴다.
import { checkPasswordPolicy } from '../src/lib/auth/password-policy.ts';

// PATH 조회를 거치지 않도록 저장소 안의 실행 파일을 직접 가리킨다(경로가 쓰기 가능하면 하이재킹된다).
// 스크립트 위치 기준이라 어느 디렉터리에서 실행해도 동작한다.
const WRANGLER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '.bin',
  'wrangler',
);

// password.ts 의 ITERATIONS 와 같아야 한다(password-script-parity.test.ts 가 잠근다).
// 갈라지면 이 스크립트로 만든 계정만 로그인 CPU 가 달라진다.
const ITERATIONS = 50_000;
const textEncoder = new TextEncoder();
const toBase64 = (bytes) => Buffer.from(bytes).toString('base64');

async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(plain),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return `pbkdf2$${ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
}

const USAGE =
  'usage: node scripts/create-user.mjs <username> --role officer|member ' +
  '[--executive] [--remote] [--display "Name"] [--dry-run]';

function parseArgs(argv) {
  const positional = [];
  const parsed = { remote: false, dryRun: false, executive: false, displayName: null, role: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--remote') parsed.remote = true;
    else if (argv[i] === '--dry-run') parsed.dryRun = true;
    else if (argv[i] === '--executive') parsed.executive = true;
    else if (argv[i] === '--display') parsed.displayName = argv[(i += 1)] ?? null;
    else if (argv[i] === '--role') parsed.role = argv[(i += 1)] ?? null;
    else positional.push(argv[i]);
  }
  return { username: positional[0], extra: positional.slice(1), ...parsed };
}

// 터미널에서 글자를 화면에 찍지 않고 한 줄을 읽는다.
function promptHidden(label) {
  const { stdin, stdout } = process;
  stdout.write(label);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = (action) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off('data', onData);
      stdout.write('\n');
      action();
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return finish(() => resolve(value));
        if (ch === '\u0003') return finish(() => reject(new Error('cancelled')));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function readStdinLine() {
  let text = '';
  for await (const chunk of process.stdin) text += chunk;
  return text.split(/\r?\n/, 1)[0];
}

async function readPassword() {
  if (process.env.TCN_USER_PASSWORD) return process.env.TCN_USER_PASSWORD;
  if (!process.stdin.isTTY) return readStdinLine();

  const first = await promptHidden('Password: ');
  const again = await promptHidden('Repeat password: ');
  if (first !== again) throw new Error('The two passwords do not match.');
  return first;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { username, extra, remote, dryRun, executive, displayName, role } = parseArgs(
  process.argv.slice(2),
);
if (!username) fail(USAGE);
if (extra.length > 0) {
  fail(
    'A password is no longer accepted as an argument (it stays in shell history and the process list).\n' +
      'Run it in a terminal to be prompted, or set TCN_USER_PASSWORD (see the header of this script).',
  );
}
// 역할 검증은 비밀번호를 묻기 전에 끝낸다. 플래그를 빠뜨린 운영자가 비밀번호를 두 번 치고 나서야 알게 되지 않도록.
if (role !== 'officer' && role !== 'member') fail(`--role officer|member is required\n${USAGE}`);
if (executive && role !== 'officer') fail('--executive is only allowed with --role officer');

// dry-run 은 SQL 만 보여 주므로 비밀번호를 받지도 해시하지도 않는다.
let passwordHash = '<password-hash>';
if (!dryRun) {
  let password;
  try {
    password = await readPassword();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
  if (!password)
    fail('No password provided. Set TCN_USER_PASSWORD or run in a terminal to be prompted.');

  const policy = checkPasswordPolicy(password, username);
  if (!policy.ok) fail(`Password rejected: ${policy.reason}`);
  passwordHash = await hashPassword(password);
}

const id = crypto.randomUUID();
const sqlLiteral = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const sql =
  `insert into users (id, username, password_hash, display_name, role, status, is_executive) values ` +
  `(${sqlLiteral(id)}, ${sqlLiteral(username)}, ${sqlLiteral(passwordHash)}, ${sqlLiteral(displayName)}, ` +
  `${sqlLiteral(role)}, 'approved', ${executive ? 1 : 0});`;

if (dryRun) {
  console.log(sql);
  process.exit(0);
}

const target = remote ? '--remote' : '--local';
try {
  execFileSync(WRANGLER, ['d1', 'execute', 'tcn-content', target, '--command', sql], {
    stdio: 'inherit',
  });
  console.log(
    `\n✅ user '${username}' created as ${role}${executive ? ' (executive)' : ''} on ` +
      `${remote ? 'remote' : 'local'} D1 (id=${id})`,
  );
} catch {
  console.error(`\n❌ failed to create '${username}' (아이디 중복이면 UNIQUE 제약 위반)`);
  process.exit(1);
}
