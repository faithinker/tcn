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
