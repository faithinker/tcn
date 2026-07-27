import { env } from 'cloudflare:workers';

// Astro 7의 Cloudflare 바인딩은 cloudflare:workers의 env로 접근한다.
// 데이터레이어는 D1Database를 인자로 받아 테스트에서 모의 D1을 주입할 수 있다.

interface Bindings {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  ASSETS?: Fetcher;
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

export function getAssets(): Fetcher {
  const assets = (env as unknown as Bindings).ASSETS;
  if (!assets) throw new Error('Assets binding "ASSETS" is not available');
  return assets;
}

export function newId(): string {
  return crypto.randomUUID();
}
