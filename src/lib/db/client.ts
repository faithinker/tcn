import { env } from 'cloudflare:workers';

// Cloudflare 바인딩 접근자. Astro 7에서 바인딩은 cloudflare:workers 의 env 로 노출된다
// (Astro.locals.runtime.env 는 제거됨). 데이터레이어 함수는 D1Database 를 인자로 받으므로
// 페이지/엔드포인트에서 getDB() 로 꺼내 넘긴다(테스트 시 모의 D1 주입 가능).

interface Bindings {
  DB?: D1Database;
  MEDIA?: R2Bucket;
}

export function getDB(): D1Database {
  const db = (env as unknown as Bindings).DB;
  if (!db) throw new Error('D1 binding "DB" is not available');
  return db;
}

export function getBucket(): R2Bucket {
  const bucket = (env as unknown as Bindings).MEDIA;
  if (!bucket) throw new Error('R2 binding "MEDIA" is not available');
  return bucket;
}

export function newId(): string {
  return crypto.randomUUID();
}
