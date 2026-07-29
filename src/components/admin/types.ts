// 에디터가 다루는 데이터 형태 — 컨테이너(PostEditor)와 추출된 하위 컴포넌트가 공유한다.

export interface EditorMedia {
  id: string;
  r2Key: string;
  kind: 'image' | 'video' | 'document';
  mimeType: string | null;
  filename: string | null;
  width: number | null;
  height: number | null;
  position: number;
  caption: string | null;
}

// 아직 업로드하지 않은 선택 파일. Save 를 누를 때 실제 미디어 행으로 승격된다 —
// 그래서 캡션·순서·대표 지정은 저장된 미디어와 같은 방식으로 미리 다룰 수 있다.
export interface PendingMedia {
  pending: true;
  id: string;
  kind: 'image' | 'video' | 'document';
  filename: string;
  caption: string | null;
  uploadMimeType: string;
  size: number;
  file: File;
  previewUrl: string | null;
}

export type MediaItem = EditorMedia | PendingMedia;

export interface EditorPost {
  id: string;
  title: string;
  summary: string | null;
  eventDate: string | null;
  address: string | null;
  body: string;
  heroMediaId: string | null;
  revision: number;
}
