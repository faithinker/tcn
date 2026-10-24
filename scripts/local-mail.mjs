#!/usr/bin/env node
// 로컬 D1 의 합성 메일함(auth_local_mail)에서 가장 최근 메일을 보여 준다. AUTH_MAIL_MODE=local 에서 가입 인증번호나
// 재설정 링크를 SQL 없이 읽기 위한 도구다. 로컬 DB 만 읽고 --remote 는 받지 않는다.
//   npm run local:mail            최근 3통
//   npm run local:mail -- 10      최근 10통
// 격리 미리보기 DB 를 쓰면 TCN_D1_PERSIST_TO=.wrangler/account-preview 를 붙인다.
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--remote')) {
  console.error('local:mail reads the local database only.');
  process.exit(1);
}
const count = Math.min(Math.max(Number.parseInt(args[0] ?? '3', 10) || 3, 1), 20);
const persist = process.env.TCN_D1_PERSIST_TO;

let rows;
try {
  const output = execFileSync(
    './node_modules/.bin/wrangler',
    [
      'd1',
      'execute',
      'tcn-content',
      '--local',
      ...(persist ? ['--persist-to', persist] : []),
      '--json',
      '--command',
      `select recipient, subject, body, datetime(created_at,'unixepoch','+9 hours') as kst from auth_local_mail order by created_at desc, id desc limit ${count}`,
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  rows = JSON.parse(output)[0].results;
} catch {
  console.error(
    'Could not read the local mailbox. Apply the migrations first: npx wrangler d1 migrations apply tcn-content --local',
  );
  process.exit(1);
}

if (rows.length === 0) {
  console.log(
    'No local mail yet. Check that AUTH_MAIL_MODE=local is set in .dev.vars and send a code from /signup.',
  );
} else {
  for (const mail of rows) {
    console.log(`--- ${mail.kst} KST  to ${mail.recipient}\n${mail.subject}\n\n${mail.body}\n`);
  }
}
