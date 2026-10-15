#!/usr/bin/env node
// 빌드 직전에 D1의 공개 세미나 목록을 src/generated/public-seminars.json 으로 내보낸다(npm run build/dev/start 앞에서 자동 실행).
// 출처는 core.ts 의 resolveContentSource 가 고른다: TCN_REQUIRE_CONTENT=1 이면 운영 D1만(실패하면 빌드 실패),
// TCN_CONTENT_SOURCE=remote|local|empty 로 직접 선택, 기본은 토큰이 있으면 remote → 로컬 D1 → 빈 스냅샷.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEMINAR_POSTS_SQL } from '../src/lib/db/post-sql.ts';
import {
  buildSnapshot,
  emptySnapshot,
  kstToday,
  parseD1CliRows,
  resolveContentSource,
  toPosts,
} from '../src/lib/public-content/core.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// PATH 조회를 거치지 않도록 저장소 안의 실행 파일을 직접 가리킨다(seed 스크립트와 같은 이유).
const WRANGLER = path.join(ROOT, 'node_modules', '.bin', 'wrangler');
// TCN_CONTENT_OUTPUT은 테스트가 개발자의 실제 스냅샷을 덮어쓰지 않으려고 쓴다.
const OUTPUT =
  process.env.TCN_CONTENT_OUTPUT ?? path.join(ROOT, 'src', 'generated', 'public-seminars.json');

function readSeminarPosts(mode) {
  const stdout = execFileSync(
    WRANGLER,
    [
      'd1',
      'execute',
      'tcn-content',
      mode === 'remote' ? '--remote' : '--local',
      '--json',
      '--command',
      SEMINAR_POSTS_SQL,
    ],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return toPosts(parseD1CliRows(stdout));
}

async function main() {
  const decision = resolveContentSource(
    process.env,
    existsSync(path.join(ROOT, '.wrangler', 'state')),
  );

  let snapshot;
  if (decision.mode === 'empty') {
    snapshot = await emptySnapshot();
  } else {
    try {
      snapshot = await buildSnapshot({
        posts: readSeminarPosts(decision.mode),
        source: decision.mode,
        today: kstToday(),
      });
    } catch (error) {
      if (!decision.fallbackToEmpty) throw error;
      console.warn(
        `public content: local D1 unreadable, using an empty snapshot (${error.message})`,
      );
      snapshot = await emptySnapshot();
    }
  }

  mkdirSync(path.dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `public content: source=${snapshot.source} seminars=${snapshot.posts.length} today=${snapshot.today} fingerprint=${snapshot.fingerprint.slice(0, 12)}`,
  );
}

main().catch((error) => {
  console.error(`public content export failed: ${error.message}`);
  process.exit(1);
});
