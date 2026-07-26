#!/usr/bin/env node
// 계정 수동 발급. 회원가입 UI 없음 — 운영자가 아이디/평문비번을 주면 해시해서 D1 에 INSERT.
//
// 사용법:
//   node scripts/create-user.mjs <username> <password> [--remote] [--display "표시이름"]
//
//   --remote  원격(운영) D1 에 생성. 없으면 로컬(.wrangler) D1.
//   --display 표시 이름(선택).
//
// 해싱은 src/lib/auth/password.ts 와 동일 알고리즘·포맷(pbkdf2$iter$salt$hash)이라 로그인 검증과 호환된다.
import { webcrypto as crypto } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// src/lib/auth/password.ts 의 ITERATIONS 와 반드시 같은 값이어야 한다.
// Workers 무료 플랜 CPU 10ms 한도에 맞춘 값 — 배경은 password.ts 주석 참고.
const ITERATIONS = 50_000;
const textEncoder = new TextEncoder();
const toBase64 = (bytes) => Buffer.from(bytes).toString('base64');

async function hashPassword(plain) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', textEncoder.encode(plain), 'PBKDF2', false, [
    'deriveBits',
  ]);
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
  return { username: positional[0], password: positional[1], remote, displayName };
}

const { username, password, remote, displayName } = parseArgs(process.argv.slice(2));
if (!username || !password) {
  console.error('usage: node scripts/create-user.mjs <username> <password> [--remote] [--display "Name"]');
  process.exit(1);
}

const id = crypto.randomUUID();
const passwordHash = await hashPassword(password);
const sqlLiteral = (value) => (value === null ? 'null' : `'${String(value).replace(/'/g, "''")}'`);
const sql =
  `insert into users (id, username, password_hash, display_name) values ` +
  `(${sqlLiteral(id)}, ${sqlLiteral(username)}, ${sqlLiteral(passwordHash)}, ${sqlLiteral(displayName)});`;

const target = remote ? '--remote' : '--local';
try {
  execFileSync('npx', ['wrangler', 'd1', 'execute', 'tcn-content', target, '--command', sql], {
    stdio: 'inherit',
  });
  console.log(`\n✅ user '${username}' created on ${remote ? 'remote' : 'local'} D1 (id=${id})`);
} catch {
  console.error(`\n❌ failed to create '${username}' (아이디 중복이면 UNIQUE 제약 위반)`);
  process.exit(1);
}
