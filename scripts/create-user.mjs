#!/usr/bin/env node
// 계정 수동 발급. 회원가입 UI 없음 — 운영자가 아이디/평문비번을 주면 해시해서 D1 에 INSERT.
//
// 사용법:
//   node scripts/create-user.mjs <username> [--remote] [--display "표시이름"]
//
//   비밀번호는 인자로 받지 않는다(셸 히스토리·프로세스 목록에 남는다). 아래 중 하나로 준다.
//     1) 터미널에서 실행하면 숨김 입력으로 두 번 묻는다(권장).
//     2) 환경변수 TCN_USER_PASSWORD (CI·스크립트용).
//        `read -rs TCN_USER_PASSWORD; export TCN_USER_PASSWORD` 로 넣으면 히스토리에도 안 남는다.
//     3) 터미널이 아니면 표준입력 첫 줄.
//   정책(src/lib/auth/password-policy.ts): 12자 이상, 아이디 미포함, 흔한 비밀번호·단순 반복/순서 거부.
//
//   --remote  원격(운영) D1 에 생성. 없으면 로컬(.wrangler) D1.
//   --display 표시 이름(선택).
//
// 해싱은 src/lib/auth/password.ts 와 동일 알고리즘·포맷(pbkdf2$iter$salt$hash)이라 로그인 검증과 호환된다.
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

// src/lib/auth/password.ts 의 ITERATIONS 와 같은 값이어야 한다. 저장 포맷이 자기서술형이라
// 값이 갈라져도 로그인 검증은 통과하고, 대신 이 스크립트로 발급한 계정만 로그인 때 다른 작업량을
// 써서 Workers 무료 플랜 CPU 10ms 한도를 넘길 수 있다 — 배경은 password.ts 주석 참고.
// 두 값이 같음은 src/lib/auth/password-script-parity.test.ts 가 잠근다.
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

function parseArgs(argv) {
  const positional = [];
  let remote = false;
  let displayName = null;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--remote') remote = true;
    else if (argv[i] === '--display') displayName = argv[(i += 1)] ?? null;
    else positional.push(argv[i]);
  }
  return { username: positional[0], extra: positional.slice(1), remote, displayName };
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

const { username, extra, remote, displayName } = parseArgs(process.argv.slice(2));
if (!username) {
  fail('usage: node scripts/create-user.mjs <username> [--remote] [--display "Name"]');
}
if (extra.length > 0) {
  fail(
    'A password is no longer accepted as an argument (it stays in shell history and the process list).\n' +
      'Run it in a terminal to be prompted, or set TCN_USER_PASSWORD (see the header of this script).',
  );
}

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

const id = crypto.randomUUID();
const passwordHash = await hashPassword(password);
const sqlLiteral = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const sql =
  `insert into users (id, username, password_hash, display_name) values ` +
  `(${sqlLiteral(id)}, ${sqlLiteral(username)}, ${sqlLiteral(passwordHash)}, ${sqlLiteral(displayName)});`;

const target = remote ? '--remote' : '--local';
try {
  execFileSync(WRANGLER, ['d1', 'execute', 'tcn-content', target, '--command', sql], {
    stdio: 'inherit',
  });
  console.log(`\n✅ user '${username}' created on ${remote ? 'remote' : 'local'} D1 (id=${id})`);
} catch {
  console.error(`\n❌ failed to create '${username}' (아이디 중복이면 UNIQUE 제약 위반)`);
  process.exit(1);
}
