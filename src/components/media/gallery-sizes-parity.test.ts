import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// EventGallery 의 sizes 는 DocumentLayout 실측 폭에서 나온 값이다. 레이아웃 폭이 바뀌면 조용히 틀려 빌드도 브라우저 게이트도 못 잡으므로
// 두 파일의 숫자를 다시 계산해 맞춘다. 상한(1.1배)은 근거 없이 키우는 것을 막는다.
const LAYOUT = readFileSync(new URL('../../layouts/DocumentLayout.astro', import.meta.url), 'utf8');
const GALLERY = readFileSync(new URL('./EventGallery.astro', import.meta.url), 'utf8');
const TAILWIND_SPACING_REM = 0.25;
const MAX_OVERSHOOT = 1.1;

function read(source: string, pattern: RegExp, label: string): string {
  const match = source.match(pattern);
  if (!match?.[1]) {
    throw new Error(`${label} 를 읽지 못했다 — 마크업이 바뀌었으면 이 테스트도 함께 고쳐야 한다.`);
  }
  return match[1];
}

// sizes 의 마지막 항목이 미디어 쿼리 없는 기본값 = 최대 뷰포트에서 쓰이는 폭.
function widestRem(sizes: string, label: string): number {
  const last = sizes.split(',').at(-1)?.trim() ?? '';
  return Number(read(last, /^([\d.]+)rem$/, `${label} 의 최종 rem 값`));
}

const layout = {
  article: Number(read(LAYOUT, /max-w-\[([\d.]+)rem\]/, 'DocumentLayout 본문 최대 폭')),
  sidebar: Number(read(LAYOUT, /lg:grid-cols-\[([\d.]+)rem_/, 'DocumentLayout 사이드바 폭')),
  columnGap:
    Number(read(LAYOUT, /lg:gap-(\d+)/, 'DocumentLayout 사이드바 간격')) * TAILWIND_SPACING_REM,
};

const gallery = {
  lead: widestRem(read(GALLERY, /const LEAD_SIZES = '([^']+)'/, 'LEAD_SIZES'), 'LEAD_SIZES'),
  cell: widestRem(read(GALLERY, /const CELL_SIZES = '([^']+)'/, 'CELL_SIZES'), 'CELL_SIZES'),
  wide: widestRem(
    read(GALLERY, /const WIDE_CELL_SIZES = '([^']+)'/, 'WIDE_CELL_SIZES'),
    'WIDE_CELL_SIZES',
  ),
  columns: Math.max(
    ...[...GALLERY.matchAll(/grid-template-columns: repeat\((\d+), minmax\(0, 1fr\)\);/g)].map(
      (match) => Number(match[1]),
    ),
  ),
  gap: Number(read(GALLERY, /gap: [\d.]+rem ([\d.]+)rem;/, '격자 열 간격')),
};

const contentColumn = layout.article - layout.sidebar - layout.columnGap;
const cellWidth = (contentColumn - (gallery.columns - 1) * gallery.gap) / gallery.columns;
const wideCellWidth = 2 * cellWidth + gallery.gap;

describe('EventGallery sizes ↔ DocumentLayout measured widths', () => {
  // 레이아웃 폭을 정당하게 바꾸는 것은 허용한다 — 그때 sizes 를 함께 고치지 않으면
  // 아래 세 단정이 실패한다. 여기서는 양쪽이 실제로 읽혔는지만 확인한다.
  it('reads both sides (guards against a silent no-op test)', () => {
    expect(layout.article).toBeGreaterThan(layout.sidebar + layout.columnGap);
    expect(gallery.columns).toBeGreaterThanOrEqual(2);
    expect(gallery.gap).toBeGreaterThan(0);
    expect(Math.min(gallery.lead, gallery.cell, gallery.wide)).toBeGreaterThan(0);
    expect(cellWidth).toBeGreaterThan(0);
  });

  it('covers the full content column for the lead image', () => {
    expect(gallery.lead).toBeGreaterThanOrEqual(contentColumn);
    expect(gallery.lead).toBeLessThanOrEqual(contentColumn * MAX_OVERSHOOT);
  });

  it('covers one grid cell', () => {
    expect(gallery.cell).toBeGreaterThanOrEqual(cellWidth);
    expect(gallery.cell).toBeLessThanOrEqual(cellWidth * MAX_OVERSHOOT);
  });

  it('covers a wide cell spanning two columns plus the gap', () => {
    expect(gallery.wide).toBeGreaterThanOrEqual(wideCellWidth);
    expect(gallery.wide).toBeLessThanOrEqual(wideCellWidth * MAX_OVERSHOOT);
  });
});
