import { deriveSeminarCollection, type SeminarCollection } from '../seminars/model';
import { buildSnapshot, kstToday, type PublicSeminarSnapshot } from './core.ts';

// scripts/export-public-content.mjs 가 빌드 직전에 쓰는 파일(gitignore). glob으로 읽어
// 파일이 없을 때도 모듈 해석이 깨지지 않게 하고, 없으면 빈 스냅샷으로 취급한다.
// 운영 배포는 TCN_REQUIRE_CONTENT=1 로 파일이 반드시 있어야만 빌드가 시작된다.
const files = import.meta.glob<PublicSeminarSnapshot>('../../generated/public-seminars.json', {
  eager: true,
  import: 'default',
});

export function readSnapshotFile(): PublicSeminarSnapshot | null {
  return Object.values(files)[0] ?? null;
}

export async function loadPublicSnapshot(): Promise<PublicSeminarSnapshot> {
  return readSnapshotFile() ?? buildSnapshot({ posts: [], source: 'empty', today: kstToday() });
}

// 상태(upcoming/today/held)는 빌드 시각이 아니라 스냅샷이 기록한 기준일로 계산한다 —
// 배포본 지문(content-fingerprint.json)이 말하는 날짜와 페이지가 보여주는 상태를 일치시킨다.
export function deriveFromSnapshot(snapshot: PublicSeminarSnapshot): SeminarCollection {
  return deriveSeminarCollection(snapshot.posts, snapshot.today);
}

export async function getPublicSeminars(): Promise<{
  snapshot: PublicSeminarSnapshot;
  collection: SeminarCollection;
}> {
  const snapshot = await loadPublicSnapshot();
  return { snapshot, collection: deriveFromSnapshot(snapshot) };
}
