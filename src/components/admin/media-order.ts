// 미디어 목록의 그룹 내 순서 이동 — React와 무관한 순수 로직.
// 이미지와 비이미지(비디오·문서)는 화면에서 별도 그룹으로 보이지만 상태는 한 배열이다.
// 이동은 "같은 그룹의 이웃과 전체 배열에서 자리 교환"으로 구현되어 그룹 경계를 넘지 않는다.

interface GroupedItem {
  id: string;
  kind: 'image' | 'video' | 'document';
}

export function moveWithinGroup<T extends GroupedItem>(
  items: T[],
  id: string,
  offset: -1 | 1,
): T[] {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const isImage = items[index].kind === 'image';
  const group = items.filter((item) => (item.kind === 'image') === isImage);
  const groupIndex = group.findIndex((item) => item.id === id);
  const destinationItem = group[groupIndex + offset];
  if (!destinationItem) return items;
  const destination = items.findIndex((item) => item.id === destinationItem.id);
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}

export function fileTypeLabel(item: { kind: string; filename: string | null }): string {
  if (item.kind === 'video') return 'VIDEO';
  const extension = item.filename?.split('.').pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : 'FILE';
}
