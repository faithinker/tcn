// 창립총회 기록 미디어의 데이터 계약 — founding-media.json 을 읽어 검증한 뒤
// 갤러리(EventGallery)가 쓰는 형태로 정리한다.
// 확대 보장은 마스터 해상도에만 의존하므로 하한(MIN_MASTER_EDGE)을 여기서 명시한다.
import rawMedia from '../data/founding-media.json';

// 라이트박스 확대(1:1)가 의미를 갖는 최소 마스터 장변. 이보다 작은 마스터로
// 교체되면 확대가 업스케일이 되어 조용히 흐려진다 — 테스트로 못 박는다.
export const MIN_MASTER_EDGE = 3200;

export interface FoundingImage {
  type: 'image';
  id: string;
  src: string;
  alt: string;
  caption: string;
  zoomable: boolean;
  role?: 'lead';
  span?: 'wide';
}

export interface FoundingVideo {
  type: 'video';
  id: string;
  src: string;
  poster: string;
  duration: string;
  alt: string;
  caption: string;
}

export type FoundingMediaItem = FoundingImage | FoundingVideo;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requireText = (value: unknown, field: string, id: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`founding-media: "${id}" 항목의 ${field} 가 비어 있다`);
  }
  return value;
};

/**
 * 원시 JSON 배열을 검증한다. 실패는 빌드 타임에 즉시 던져서
 * alt·캡션 누락이 배포까지 흘러가지 않게 한다.
 */
export function parseFoundingMedia(raw: unknown): FoundingMediaItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error('founding-media: 항목이 비어 있다');
  }

  const seen = new Set<string>();
  const items = raw.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`founding-media: ${index}번 항목이 객체가 아니다`);

    const id = requireText(entry.id, 'id', String(index));
    if (seen.has(id)) throw new Error(`founding-media: id 중복 — "${id}"`);
    seen.add(id);

    const alt = requireText(entry.alt, 'alt', id);
    const caption = requireText(entry.caption, 'caption', id);

    if (entry.type === 'video') {
      const src = requireText(entry.src, 'src', id);
      if (!src.startsWith('/')) {
        throw new Error(`founding-media: "${id}" 영상 src 는 절대 경로여야 한다 — ${src}`);
      }
      return {
        type: 'video',
        id,
        src,
        poster: requireText(entry.poster, 'poster', id),
        duration: requireText(entry.duration, 'duration', id),
        alt,
        caption,
      } satisfies FoundingVideo;
    }

    if (entry.type !== 'image') {
      throw new Error(`founding-media: "${id}" 의 type 이 image/video 가 아니다`);
    }

    if (entry.role !== undefined && entry.role !== 'lead') {
      throw new Error(`founding-media: "${id}" 의 role 은 lead 만 허용한다`);
    }
    if (entry.span !== undefined && entry.span !== 'wide') {
      throw new Error(`founding-media: "${id}" 의 span 은 wide 만 허용한다`);
    }

    return {
      type: 'image',
      id,
      src: requireText(entry.src, 'src', id),
      alt,
      caption,
      // 초상 노출 판단이 사진마다 갈릴 수 있어 기본을 명시적으로 받는다.
      zoomable: entry.zoomable !== false,
      ...(entry.role === 'lead' ? { role: 'lead' as const } : {}),
      ...(entry.span === 'wide' ? { span: 'wide' as const } : {}),
    } satisfies FoundingImage;
  });

  const leads = items.filter((item) => item.type === 'image' && item.role === 'lead');
  if (leads.length !== 1) {
    throw new Error(`founding-media: lead 사진은 정확히 1장이어야 한다 — 현재 ${leads.length}장`);
  }

  return items;
}

export const foundingMedia: FoundingMediaItem[] = parseFoundingMedia(rawMedia);

export const isImage = (item: FoundingMediaItem): item is FoundingImage => item.type === 'image';

/** 대표컷 — 갤러리 최상단 전폭 배치. */
export function leadImage(items: FoundingMediaItem[] = foundingMedia): FoundingImage {
  const lead = items.find((item) => isImage(item) && item.role === 'lead');
  if (!lead || !isImage(lead)) throw new Error('founding-media: lead 사진이 없다');
  return lead;
}

/** 대표컷을 뺀 나머지 — 격자에 순서대로 들어간다. */
export function gridItems(items: FoundingMediaItem[] = foundingMedia): FoundingMediaItem[] {
  return items.filter((item) => !(isImage(item) && item.role === 'lead'));
}
