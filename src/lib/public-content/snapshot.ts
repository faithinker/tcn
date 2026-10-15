import { deriveSeminarCollection, type SeminarCollection } from '../seminars/model';
import { buildSnapshot, kstToday, type PublicSeminarSnapshot } from './core.ts';

// 내보내기 스크립트가 빌드 직전에 쓰는 파일(gitignore). glob으로 읽어 파일이 없어도 해석이 깨지지 않는다.
// 없으면 빈 스냅샷이고, 운영 배포는 TCN_REQUIRE_CONTENT=1 로 파일 없이는 빌드되지 않는다.
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

// 상태(upcoming/today/held)는 빌드 시각이 아니라 스냅샷의 기준일로 계산해 배포본 지문의 날짜와 맞춘다.
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
