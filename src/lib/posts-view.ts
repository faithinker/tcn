// 공개 상세용 뷰 헬퍼: D1 post(마크다운 본문 + media 행) → 렌더 가능한 형태.
// 본문은 admin 에디터(Tiptap→Markdown, html:false)가 만든 마크다운이므로
// raw HTML은 이스케이프한다(에디터가 생성하지 않는 입력 = 신뢰하지 않음).
import { Marked } from 'marked';

import type { Media } from './db/types';

const marked = new Marked({ gfm: true, async: false });

export function renderPostBody(markdown: string): string {
  const source = markdown.trim();
  if (!source) return '';
  // marked는 기본적으로 raw HTML을 통과시키므로 먼저 이스케이프한다.
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return marked.parse(escaped) as string;
}

export interface GroupedMedia {
  hero?: Media;
  images: Media[];
  videos: Media[];
  documents: Media[];
}

export function groupMedia(items: Media[], heroMediaId: string | null): GroupedMedia {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const hero = heroMediaId ? sorted.find((m) => m.id === heroMediaId && m.kind === 'image') : undefined;
  return {
    hero,
    images: sorted.filter((m) => m.kind === 'image' && m.id !== hero?.id),
    videos: sorted.filter((m) => m.kind === 'video'),
    documents: sorted.filter((m) => m.kind === 'document'),
  };
}
