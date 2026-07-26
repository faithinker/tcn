// 공개 상세용 뷰 헬퍼: D1 post(마크다운 본문 + media 행) → 렌더 가능한 형태.
// 본문은 admin 에디터(Tiptap→Markdown, html:false)가 만든 마크다운이므로
// raw HTML은 이스케이프한다(에디터가 생성하지 않는 입력 = 신뢰하지 않음).
import { Marked, type Token, type Tokens } from 'marked';

import type { Media } from './db/types';
import type { LightboxEntry } from './media-lightbox';

// 링크·이미지 프로토콜 화이트리스트 — 에디터가 만드는 것(http/https/mailto)과
// 사이트 내부 경로·앵커만. javascript:/data: 등은 무해한 '#'으로 치환.
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#)/i;

export interface PostHeading {
  depth: 2 | 3;
  id: string;
  text: string;
}

export interface RenderedPostContent {
  html: string;
  headings: PostHeading[];
}

function tokenText(tokens: Token[]): string {
  return tokens
    .map((token) => {
      if ('tokens' in token && Array.isArray(token.tokens)) return tokenText(token.tokens);
      if ('text' in token && typeof token.text === 'string') return token.text;
      return '';
    })
    .join('');
}

function headingSlug(text: string, fallbackIndex: number): string {
  const slug = text
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `section-${fallbackIndex}`;
}

export function renderPostContent(markdown: string): RenderedPostContent {
  const source = markdown.trim();
  if (!source) return { html: '', headings: [] };
  // marked는 기본적으로 raw HTML을 통과시키므로 먼저 이스케이프한다.
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const headings: PostHeading[] = [];
  const slugCounts = new Map<string, number>();
  const marked = new Marked({ gfm: true, async: false });
  marked.use({
    renderer: {
      heading(token: Tokens.Heading) {
        if (token.depth !== 2 && token.depth !== 3) {
          return `<h${token.depth}>${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
        }
        const text = tokenText(token.tokens);
        const base = headingSlug(text, headings.length + 1);
        const count = (slugCounts.get(base) ?? 0) + 1;
        slugCounts.set(base, count);
        const id = count === 1 ? base : `${base}-${count}`;
        headings.push({ depth: token.depth, id, text });
        return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`;
      },
    },
    walkTokens(token) {
      if (token.type === 'link' || token.type === 'image') {
        const target = token as { href: string };
        if (!SAFE_HREF.test(target.href?.trim() ?? '')) target.href = '#';
      }
    },
  });
  return { html: marked.parse(escaped) as string, headings };
}

export function renderPostBody(markdown: string): string {
  return renderPostContent(markdown).html;
}

export interface GroupedMedia {
  hero?: Media;
  images: Media[];
  videos: Media[];
  documents: Media[];
}

export function seminarLightboxEntries(
  grouped: GroupedMedia,
  seminarLabel: string,
): LightboxEntry[] {
  const images = grouped.hero ? [grouped.hero, ...grouped.images] : grouped.images;
  return images.map((item, index) => {
    const alt = mediaAlt(item, seminarLabel, index + 1);
    return {
      id: item.id,
      type: 'image',
      src: `/media/${item.r2Key}`,
      alt,
      caption: item.caption?.trim() || alt,
    };
  });
}

export function groupMedia(items: Media[], heroMediaId: string | null): GroupedMedia {
  const sorted = [...items].sort((a, b) => a.position - b.position);
  const hero = heroMediaId ? sorted.find((m) => m.id === heroMediaId && m.kind === 'image') : undefined;
  return {
    hero,
    images: sorted.filter((m) => m.kind === 'image' && m.id !== hero?.id),
    // 영상은 transcript가 저장되기 전까지 공개 페이지에 노출하지 않는다.
    videos: sorted.filter((m) => m.kind === 'video' && Boolean(m.caption?.trim())),
    documents: sorted.filter((m) => m.kind === 'document'),
  };
}

export function mediaAlt(item: Media, seminarLabel: string, index: number): string {
  return item.caption?.trim() || `Photo ${index} from the ${seminarLabel}.`;
}
