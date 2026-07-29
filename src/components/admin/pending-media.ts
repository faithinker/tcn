// 저장 전 스테이징(선택만 해둔 파일) 로직 — React 와 무관한 순수 함수.
// 에디터는 저장된 미디어와 스테이징 파일을 한 배열로 다룬다: 순서 이동·캡션·대표 지정이
// 업로드 시점과 무관하게 같은 코드로 동작하고, Save 가 스테이징을 실제 행으로 승격한다.
import type { EditorMedia, MediaItem, PendingMedia } from './types';

export const PENDING_ID_PREFIX = 'pending-';

export function isPendingMedia(item: MediaItem): item is PendingMedia {
  return 'pending' in item;
}

export function countPendingMedia(items: MediaItem[]): number {
  return items.filter(isPendingMedia).length;
}

export function mediaPreviewSrc(item: MediaItem): string | null {
  return isPendingMedia(item) ? item.previewUrl : `/media/${item.r2Key}`;
}

// 업로드가 끝난 스테이징 항목을 같은 자리에서 저장된 미디어로 교체한다(순서 유지).
// 업로드 중에 입력한 캡션은 서버 응답(caption: null)이 아니라 화면 값을 남긴다.
export function replacePendingMedia(
  items: MediaItem[],
  pendingId: string,
  uploaded: EditorMedia,
): MediaItem[] {
  const index = items.findIndex((item) => item.id === pendingId);
  if (index < 0) return items;
  const next = [...items];
  next[index] = { ...uploaded, caption: items[index].caption ?? uploaded.caption };
  return next;
}

// 열린 캡션 필드처럼 id 로 keying 된 UI 상태를 서버가 부여한 id 로 옮긴다.
export function remapMediaIds(ids: ReadonlySet<string>, mapping: Map<string, string>): Set<string> {
  return new Set([...ids].map((id) => mapping.get(id) ?? id));
}

export function pendingNotice(count: number): string {
  if (count === 0) return '';
  if (count === 1) return '1 file ready. Press Save to upload it.';
  return `${count} files ready. Press Save to upload them.`;
}
