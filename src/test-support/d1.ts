// SQL 안에 로직이 든 코드를 진짜 SQLite 로 돌리기 위한 테스트 헬퍼.
//
// 왜 필요한가: rate limiter 는 윈도 리셋·잠금·허용 판정을 전부 SQL 로 한다.
// D1 을 목킹하면 bind 인자와 쿼리 문자열만 보게 되어 정작 판단 로직이 검증되지 않는다.
//
// 왜 miniflare 가 아닌가: miniflare 는 wrangler 의 전이 의존성이라 우리가 버전을 고르지
// 못한다. 실제로 락파일은 wrangler 가 선언한 4.x 가 아니라 5.x-alpha 를 물고 있고,
// 5 는 생성자 옵션 모델을 통째로 바꿨다. 테스트 인프라를 그 위에 올리면 우리가 관리하지
// 않는 alpha API 를 따라다녀야 한다.
//
// 그래서 Node 22 내장 node:sqlite 위에 D1 모양의 얇은 어댑터를 둔다. 의존성이 늘지 않고
// 버전 결합도 없다. D1 은 SQLite 이므로 여기서 검증하는 SQL 의미론(?N 파라미터, 조건부
// UPSERT, RETURNING, CHECK 제약)은 그대로 성립한다.
//
// 범위: SQL 의미론만 본다. D1 의 네트워크 동작·바인딩 주입·배치 트랜잭션 경계는 다루지
// 않는다. 그쪽은 CI 의 `npm run test:qna:d1`(wrangler d1 execute --local)이 맡는다.
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
 * D1PreparedStatement 의 부분 구현. bind() 는 D1 과 마찬가지로 원본을 바꾸지 않고
 * 새 인스턴스를 돌려준다 — auth 쪽 recordLoginFailure 가 하나의 statement 를 두 번
 * bind 해서 batch 에 넣으므로, 이 불변성이 깨지면 두 식별자가 같은 행을 쓰게 된다.
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

  run(): Promise<{ success: true }> {
    this.prepared().run(...(this.params as never[]));
    return Promise.resolve({ success: true });
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
  ): Promise<{ results: T[]; success: true }[]> {
    const results = [];
    for (const statement of statements) results.push(await statement.all<T>());
    return results;
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
