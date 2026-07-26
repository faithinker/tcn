// D1 슬림 스키마(0001_init.sql)에 대응하는 앱 레벨 타입.
// SQL 컬럼(snake_case) → JS(camelCase)는 각 쿼리의 select alias로 매핑한다.

export type MediaKind = 'image' | 'video' | 'document';

export interface Post {
  id: string;
  title: string;
  summary: string | null;
  eventDate: string | null; // YYYY-MM-DD
  address: string | null;
  body: string; // 마크다운
  heroMediaId: string | null;
  authorId: string | null;
  revision: number;
  createdAt: number; // unix seconds
  updatedAt: number;
  deletedAt: number | null; // null = 노출
}

export interface PostInput {
  title: string;
  summary?: string | null;
  eventDate?: string | null;
  address?: string | null;
  body?: string;
  heroMediaId?: string | null;
  authorId?: string | null;
  expectedRevision?: number;
}

export interface Media {
  id: string;
  postId: string;
  r2Key: string;
  kind: MediaKind;
  mimeType: string | null;
  filename: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  position: number;
  caption: string | null;
  createdAt: number;
}

export interface MediaInput {
  postId: string;
  r2Key: string;
  kind: MediaKind;
  mimeType?: string | null;
  filename?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  position?: number;
  caption?: string | null;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string | null;
  sessionVersion: number;
  createdAt: number;
}
