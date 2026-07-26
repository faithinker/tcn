import { describe, expect, it } from 'vitest';

import { groupMedia, renderPostBody } from './posts-view';
import type { Media } from './db/types';

const media = (overrides: Partial<Media>): Media => ({
  id: 'm1',
  postId: 'p1',
  r2Key: 'p1/a.webp',
  kind: 'image',
  mimeType: 'image/webp',
  filename: 'a.webp',
  size: 100,
  width: 800,
  height: 600,
  duration: null,
  position: 0,
  caption: null,
  createdAt: 0,
  ...overrides,
});

describe('renderPostBody', () => {
  it('renders markdown to HTML (headings, bold, lists, links)', () => {
    const html = renderPostBody('## 제목\n\n**굵게** 그리고 [링크](https://example.org)\n\n- 하나\n- 둘');
    expect(html).toContain('<h2>제목</h2>');
    expect(html).toContain('<strong>굵게</strong>');
    expect(html).toContain('<a href="https://example.org">링크</a>');
    expect(html).toContain('<li>하나</li>');
  });

  it('escapes raw HTML in the source instead of passing it through', () => {
    const html = renderPostBody('본문 <script>alert(1)</script>');
    expect(html).not.toContain('<script>');
  });

  it('returns empty string for empty body', () => {
    expect(renderPostBody('')).toBe('');
    expect(renderPostBody('   ')).toBe('');
  });

  it('neutralizes unsafe link and image protocols', () => {
    expect(renderPostBody('[클릭](javascript:alert(1))')).not.toContain('javascript:');
    expect(renderPostBody('[클릭](JaVaScRiPt:alert(1))')).not.toContain('avascript:');
    expect(renderPostBody('![x](data:text/html;base64,PHNjcmlwdD4=)')).not.toContain('data:');
    expect(renderPostBody('[안전](https://example.org)')).toContain('href="https://example.org"');
    expect(renderPostBody('[메일](mailto:a@b.c)')).toContain('href="mailto:a@b.c"');
    expect(renderPostBody('[내부](/seminars)')).toContain('href="/seminars"');
  });
});

describe('groupMedia', () => {
  it('splits media by kind and pulls the hero image out of the gallery', () => {
    const items = [
      media({ id: 'hero', r2Key: 'p1/hero.webp' }),
      media({ id: 'img2', r2Key: 'p1/b.webp', position: 1 }),
      media({ id: 'vid', kind: 'video', mimeType: 'video/mp4', filename: 'clip.mp4', position: 2 }),
      media({ id: 'doc', kind: 'document', mimeType: 'application/pdf', filename: 'file.pdf', position: 3 }),
    ];
    const grouped = groupMedia(items, 'hero');
    expect(grouped.hero?.id).toBe('hero');
    expect(grouped.images.map((m) => m.id)).toEqual(['img2']);
    expect(grouped.videos.map((m) => m.id)).toEqual(['vid']);
    expect(grouped.documents.map((m) => m.id)).toEqual(['doc']);
  });

  it('keeps every image in the gallery when there is no hero', () => {
    const items = [media({ id: 'a' }), media({ id: 'b', position: 1 })];
    const grouped = groupMedia(items, null);
    expect(grouped.hero).toBeUndefined();
    expect(grouped.images).toHaveLength(2);
  });
});
