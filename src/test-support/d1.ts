// SQL 안에 로직이 든 코드(rate limiter 등)를 진짜 SQLite 로 돌리는 테스트 헬퍼. D1 을 목킹하면 쿼리 문자열만 보게 된다.
// miniflare 는 wrangler 의 전이 의존성이라 버전을 고를 수 없어, Node 내장 node:sqlite 위에 D1 모양의 얇은 어댑터를 둔다.
// SQL 의미론만 본다. 네트워크·바인딩 주입·배치 트랜잭션 경계는 CI 의 `npm run test:qna:d1`(wrangler d1 execute --local)이 맡는다.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

// 저장소 경로에 공백이 들어갈 수 있으므로 URL.pathname 이 아니라 fileURLToPath 로 푼다.
const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

function migrationStatements(): string[] {
  // 마이그레이션은 순서가 곧 스키마다. 기본 .sort() 는 구현체 정렬 규칙에 기대므로
  // 0001_ 접두사 기준으로 명시적으로 비교한다.
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));

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

type Params = readonly unknown[];

/**
 * D1PreparedStatement 의 부분 구현. bind() 는 D1 처럼 새 인스턴스를 돌려준다.
 * recordLoginFailure 가 한 statement 를 두 번 bind 해 batch 에 넣으므로 깨지면 두 식별자가 같은 행을 쓴다.
 */
class SqliteStatement {
  constructor(
    private readonly sql: string,
    private readonly database: DatabaseSync,
    private readonly params: Params = [],
  ) {}

  bind(...params: unknown[]): SqliteStatement {
    return new SqliteStatement(this.sql, this.database, params);
  }

  private prepared() {
    return this.database.prepare(this.sql);
  }

  /** D1 은 행이 없으면 null 을 준다. node:sqlite 의 undefined 를 맞춰 준다. */
  first<T = Record<string, unknown>>(): Promise<T | null> {
    const row = this.prepared().get(...(this.params as never[]));
    return Promise.resolve((row as T | undefined) ?? null);
  }

  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: true }> {
    return Promise.resolve({
      results: this.prepared().all(...(this.params as never[])) as T[],
      success: true,
    });
  }

  run(): Promise<{ success: true; meta: { changes: number } }> {
    const { success, meta } = this.execute();
    return Promise.resolve({ success, meta });
  }

  execute<T = Record<string, unknown>>(): {
    results: T[];
    success: true;
    meta: { changes: number };
  } {
    const statement = this.prepared();
    const params = this.params as never[];
    if (statement.columns().length > 0) {
      return { results: statement.all(...params) as T[], success: true, meta: { changes: 0 } };
    }
    const { changes } = statement.run(...params);
    return { results: [], success: true, meta: { changes: Number(changes) } };
  }
}

class SqliteD1 {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string): SqliteStatement {
    return new SqliteStatement(sql, this.database);
  }

  /** D1 의 batch 는 순차 실행 + 결과 배열. 여기서는 트랜잭션 경계를 흉내내지 않는다. */
  async batch<T = Record<string, unknown>>(
    statements: SqliteStatement[],
  ): Promise<{ results: T[]; success: true; meta: { changes: number } }[]> {
    return statements.map((statement) => statement.execute<T>());
  }
}

export interface TestD1 {
  db: D1Database;
  dispose: () => Promise<void>;
}

/** 마이그레이션이 적용된 빈 인메모리 데이터베이스를 연다. 호출자가 dispose 해야 한다. */
export async function openTestD1(): Promise<TestD1> {
  const database = new DatabaseSync(':memory:');
  for (const statement of migrationStatements()) {
    database.exec(statement);
  }

  return {
    db: new SqliteD1(database) as unknown as D1Database,
    dispose: async () => database.close(),
  };
}
