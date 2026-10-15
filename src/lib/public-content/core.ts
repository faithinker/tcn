// 정적 공개 페이지(홈·세미나 목록·소개)의 데이터 계약. 내보내기 스크립트(Node 직접 실행)·
// 프리렌더 페이지·Worker가 함께 쓰므로 타입 import 외의 런타임 import를 넣지 말 것.

import type { Post } from '../db/types.ts';

export type SnapshotSource = 'remote' | 'local' | 'empty';

export interface PublicSeminarSnapshot {
  schema: 1;
  source: SnapshotSource;
  generatedAt: string;
  /** 상태 계산의 기준일(KST). 페이지는 빌드 시각이 아니라 이 값을 쓴다. */
  today: string;
  fingerprint: string;
  posts: Post[];
}

export interface FingerprintDoc {
  fingerprint: string;
  today: string;
}

// 정적 페이지가 그리는 필드만 지문에 넣는다(본문·리비전 변경은 SSR 상세 페이지가 바로 반영한다).
type FingerprintPost = Pick<Post, 'id' | 'title' | 'summary' | 'eventDate' | 'address'>;

// model.ts의 siteToday와 같은 값을 낸다(model.ts는 Node가 못 읽어 복제했고 core.test.ts가 일치를 고정한다).
export function kstToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export async function seminarFingerprint(
  posts: readonly FingerprintPost[],
  today: string,
): Promise<string> {
  const rows = posts
    .map((post) => [post.id, post.title, post.summary, post.eventDate, post.address])
    .toSorted(
      (a, b) =>
        String(a[3]).localeCompare(String(b[3])) || String(a[0]).localeCompare(String(b[0])),
    );
  const bytes = new TextEncoder().encode(JSON.stringify({ today, rows }));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildSnapshot(input: {
  posts: Post[];
  source: SnapshotSource;
  today: string;
  now?: Date;
}): Promise<PublicSeminarSnapshot> {
  return {
    schema: 1,
    source: input.source,
    generatedAt: (input.now ?? new Date()).toISOString(),
    today: input.today,
    fingerprint: await seminarFingerprint(input.posts, input.today),
    posts: input.posts,
  };
}

export function emptySnapshot(now = new Date()): Promise<PublicSeminarSnapshot> {
  return buildSnapshot({ posts: [], source: 'empty', today: kstToday(now), now });
}

// `wrangler d1 execute --json`은 [{ results: [...], success, meta }] 를 출력한다.
export function parseD1CliRows(stdout: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error('wrangler d1 execute did not print JSON');
  }
  const first = Array.isArray(parsed) ? parsed[0] : null;
  const results = (first as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) throw new Error('wrangler d1 execute JSON has no results array');
  return results;
}

const nullableString = (value: unknown) => value === null || typeof value === 'string';

export function toPosts(rows: unknown[]): Post[] {
  return rows.map((row, index) => {
    const post = row as Record<string, unknown> | null;
    const valid =
      post !== null &&
      typeof post === 'object' &&
      typeof post.id === 'string' &&
      typeof post.title === 'string' &&
      typeof post.eventDate === 'string' &&
      post.eventDate !== '' &&
      typeof post.body === 'string' &&
      nullableString(post.summary) &&
      nullableString(post.address) &&
      nullableString(post.heroMediaId) &&
      nullableString(post.authorId) &&
      typeof post.revision === 'number' &&
      typeof post.createdAt === 'number' &&
      typeof post.updatedAt === 'number' &&
      post.deletedAt === null;
    if (!valid) throw new Error(`seminar row ${index} does not match the Post shape`);
    return post as unknown as Post;
  });
}

export interface SourceDecision {
  mode: SnapshotSource;
  required: boolean;
  /** local 자동 선택이 실패하면 빈 스냅샷으로 빌드를 이어간다. */
  fallbackToEmpty: boolean;
}

type Env = Readonly<Record<string, string | undefined>>;

export function resolveContentSource(env: Env, localStateExists: boolean): SourceDecision {
  const required = env.TCN_REQUIRE_CONTENT === '1';
  const explicit = env.TCN_CONTENT_SOURCE;
  if (explicit !== undefined && !['remote', 'local', 'empty'].includes(explicit)) {
    throw new Error(`TCN_CONTENT_SOURCE must be remote, local or empty (got "${explicit}")`);
  }

  // 운영 배포: 빈 사이트나 로컬 DB 내용이 나가는 사고를 빌드 단계에서 막는다.
  if (required) {
    if (explicit !== undefined && explicit !== 'remote') {
      throw new Error('TCN_REQUIRE_CONTENT=1 only allows the remote production D1');
    }
    if (!env.CLOUDFLARE_API_TOKEN) {
      throw new Error('TCN_REQUIRE_CONTENT=1 needs CLOUDFLARE_API_TOKEN to read production D1');
    }
    return { mode: 'remote', required: true, fallbackToEmpty: false };
  }

  if (explicit !== undefined) {
    return { mode: explicit as SnapshotSource, required: false, fallbackToEmpty: false };
  }
  if (env.CLOUDFLARE_API_TOKEN) return { mode: 'remote', required: false, fallbackToEmpty: false };
  if (localStateExists) return { mode: 'local', required: false, fallbackToEmpty: true };
  return { mode: 'empty', required: false, fallbackToEmpty: false };
}

export function parseFingerprintDoc(text: string, label: string): FingerprintDoc {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not JSON`);
  }
  const doc = parsed as Partial<FingerprintDoc> | null;
  if (typeof doc?.fingerprint !== 'string' || typeof doc.today !== 'string') {
    throw new Error(`${label} has no fingerprint/today`);
  }
  return { fingerprint: doc.fingerprint, today: doc.today };
}

export function decideRefresh(
  live: FingerprintDoc,
  baked: FingerprintDoc,
): { rebuild: boolean; reason: string } {
  if (live.fingerprint === baked.fingerprint) return { rebuild: false, reason: 'up to date' };
  return {
    rebuild: true,
    reason: live.today === baked.today ? 'content changed' : 'KST date changed',
  };
}
