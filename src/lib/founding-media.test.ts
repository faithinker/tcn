import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  MIN_MASTER_EDGE,
  foundingMedia,
  gridItems,
  isImage,
  leadImage,
  parseFoundingMedia,
} from './founding-media';

const ASSET_DIR = path.resolve(import.meta.dirname, '../assets/founding');

/**
 * JPEG SOF 마커에서 해상도만 읽는다. 확대 보장을 검증하려면 마스터의 실제
 * 픽셀이 필요한데, 그 한 가지 때문에 이미지 라이브러리를 테스트에 끌어오지 않는다.
 */
function readJpegSize(file: string): { width: number; height: number } {
  const buf = readFileSync(file);
  let offset = 2; // SOI 건너뛰기
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0/1/2/9/10 등 프레임 헤더에 높이·너비가 들어 있다(DHT·DAC 는 제외).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  throw new Error(`SOF 마커를 못 찾았다: ${file}`);
}

const imageItems = foundingMedia.filter(isImage);

describe('founding-media 데이터 계약', () => {
  it('실제 JSON 이 계약을 통과한다', () => {
    expect(foundingMedia.length).toBeGreaterThan(1);
    expect(imageItems.length).toBeGreaterThan(0);
    expect(foundingMedia.some((item) => item.type === 'video')).toBe(true);
  });

  it('모든 항목에 alt 와 캡션이 있다', () => {
    for (const item of foundingMedia) {
      expect(item.alt.trim().length, `${item.id} alt`).toBeGreaterThan(10);
      expect(item.caption.trim().length, `${item.id} caption`).toBeGreaterThan(10);
    }
  });

  it('대표컷은 정확히 1장이고 격자는 나머지를 받는다', () => {
    expect(leadImage().id).toBe('myeongnyundang');
    expect(gridItems()).toHaveLength(foundingMedia.length - 1);
    expect(gridItems().some((item) => isImage(item) && item.role === 'lead')).toBe(false);
  });

  it('alt 가 비면 빌드가 실패한다', () => {
    expect(() =>
      parseFoundingMedia([
        { id: 'a', type: 'image', src: 'x', alt: '', caption: 'c', role: 'lead' },
      ]),
    ).toThrow(/alt/);
  });

  it('루트가 배열이 아니거나 비어 있으면 실패한다', () => {
    expect(() => parseFoundingMedia(null)).toThrow(/비어 있다/);
    expect(() => parseFoundingMedia([])).toThrow(/비어 있다/);
  });

  it('객체가 아닌 항목과 알 수 없는 미디어 타입을 거부한다', () => {
    expect(() => parseFoundingMedia(['image'])).toThrow(/객체가 아니다/);
    expect(() =>
      parseFoundingMedia([
        {
          id: 'unknown',
          type: 'audio',
          alt: 'a'.repeat(20),
          caption: 'c'.repeat(20),
        },
      ]),
    ).toThrow(/image\/video/);
  });

  it('허용하지 않는 role 과 span 값을 거부한다', () => {
    const item = {
      id: 'lead',
      type: 'image',
      src: 'x',
      alt: 'a'.repeat(20),
      caption: 'c'.repeat(20),
    };
    expect(() => parseFoundingMedia([{ ...item, role: 'hero' }])).toThrow(/role/);
    expect(() => parseFoundingMedia([{ ...item, role: 'lead', span: 'full' }])).toThrow(/span/);
  });

  it('zoomable:false 를 명시적으로 보존한다', () => {
    const [item] = parseFoundingMedia([
      {
        id: 'lead',
        type: 'image',
        src: 'x',
        alt: 'a'.repeat(20),
        caption: 'c'.repeat(20),
        role: 'lead',
        zoomable: false,
      },
    ]);
    expect(item.type === 'image' && item.zoomable).toBe(false);
  });

  it('id 중복을 잡는다', () => {
    const item = { id: 'dup', type: 'image', src: 'x', alt: 'a'.repeat(20), caption: 'c' };
    expect(() => parseFoundingMedia([{ ...item, role: 'lead' }, item])).toThrow(/중복/);
  });

  it('대표컷이 없거나 둘 이상이면 실패한다', () => {
    const item = (id: string, role?: string) => ({
      id,
      type: 'image',
      src: 'x',
      alt: 'a'.repeat(20),
      caption: 'c'.repeat(20),
      ...(role ? { role } : {}),
    });
    expect(() => parseFoundingMedia([item('a')])).toThrow(/lead/);
    expect(() => parseFoundingMedia([item('a', 'lead'), item('b', 'lead')])).toThrow(/lead/);
  });

  it('사용자 지정 목록에서도 대표컷이 없으면 leadImage 가 실패한다', () => {
    expect(() =>
      leadImage([
        {
          id: 'plain',
          type: 'image',
          src: 'x',
          alt: 'a'.repeat(20),
          caption: 'c'.repeat(20),
          zoomable: true,
        },
      ]),
    ).toThrow(/lead/);
  });

  it('영상 src 는 절대 경로여야 한다', () => {
    expect(() =>
      parseFoundingMedia([
        { id: 'lead', type: 'image', src: 'x', alt: 'a'.repeat(20), caption: 'c'.repeat(20), role: 'lead' },
        {
          id: 'v',
          type: 'video',
          src: 'media/x.mp4',
          poster: 'p',
          duration: '0:11',
          alt: 'a'.repeat(20),
          caption: 'c'.repeat(20),
        },
      ]),
    ).toThrow(/절대 경로/);
  });
});

describe('마스터 자산', () => {
  it('모든 이미지 항목에 대응하는 마스터 파일이 있다', () => {
    const files = new Set(readdirSync(ASSET_DIR));
    for (const item of imageItems) {
      expect(files.has(`${item.src}.jpg`), `${item.src}.jpg 없음`).toBe(true);
    }
    for (const item of foundingMedia) {
      if (item.type === 'video') {
        expect(files.has(`${item.poster}.jpg`), `${item.poster}.jpg 없음`).toBe(true);
      }
    }
  });

  it(`마스터 장변이 ${MIN_MASTER_EDGE}px 이상이다 (라이트박스 1:1 확대 보장)`, () => {
    for (const item of imageItems) {
      const { width, height } = readJpegSize(path.join(ASSET_DIR, `${item.src}.jpg`));
      expect(Math.max(width, height), `${item.src} 장변`).toBeGreaterThanOrEqual(MIN_MASTER_EDGE);
    }
  });

  it('마스터에 EXIF 회전 플래그가 남아 있지 않다', () => {
    // 회전을 픽셀에 베이크했으므로 Orientation 태그 자체가 없어야 한다.
    for (const item of imageItems) {
      const buf = readFileSync(path.join(ASSET_DIR, `${item.src}.jpg`));
      expect(buf.includes(Buffer.from('Exif')), `${item.src} EXIF 잔존`).toBe(false);
    }
  });
});
