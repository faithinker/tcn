// 실제 D1(workerd + SQLite)을 띄우는 테스트 헬퍼.
//
// rate limiter 처럼 로직이 SQL 안에 들어 있는 코드는 D1 을 목킹하면 bind 인자와
// 쿼리 문자열만 검증하게 되어 윈도 리셋·잠금 같은 실제 의미론이 통째로 비게 된다.
// miniflare 는 wrangler 에 딸려 오므로 추가 의존성 없이 진짜 D1 을 쓸 수 있다.
//
// 스키마는 migrations/ 를 순서대로 실행해 만든다. 테스트가 실제 배포 스키마와
// 어긋나면 바로 깨지도록 하기 위해서다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

// 저장소 경로에 공백이 들어갈 수 있으므로 URL.pathname 이 아니라 fileURLToPath 로 푼다.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

function migrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  return files.flatMap((name) =>
    readFileSync(join(MIGRATIONS_DIR, name), 'utf8')
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n')
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean),
  );
}

export interface TestD1 {
  db: D1Database;
  dispose: () => Promise<void>;
}

/** 마이그레이션이 적용된 빈 인메모리 D1 을 연다. 호출자가 dispose 해야 한다. */
export async function openTestD1(): Promise<TestD1> {
  const miniflare = new Miniflare({
    modules: true,
    script: 'export default { fetch: () => new Response("test-only") };',
    d1Databases: { DB: ':memory:' },
  });

  const db = (await miniflare.getD1Database('DB')) as unknown as D1Database;
  for (const statement of migrationStatements()) {
    await db.prepare(statement).run();
  }

  return { db, dispose: () => miniflare.dispose() };
}
