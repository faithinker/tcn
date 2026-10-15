// 미디어 목록의 그룹 내 순서 이동(순수 로직). 이미지와 비이미지는 한 배열이지만 같은 그룹의 이웃과만 자리를 바꿔 그룹 경계를 넘지 않는다.

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
