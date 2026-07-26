// 마스터 자산 해석 + 라이트박스 계층 URL 생성.
// 확대(1:1)·원본 URL 은 해시된 자산 경로라 런타임에 추측할 수 없다 → 빌드 타임에
// getImage 로 확정해서 DOM 으로 넘긴다. 클라이언트에는 경로 조립 로직이 없다.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { isImage, type FoundingMediaItem } from '../../lib/founding-media';

const masters = import.meta.glob<{ default: ImageMetadata }>('../../assets/founding/*.jpg', {
  eager: true,
});
const originalUrls = import.meta.glob<string>('../../assets/founding/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});

export function master(name: string): ImageMetadata {
  const entry = masters[`../../assets/founding/${name}.jpg`];
  if (!entry) throw new Error(`founding-media: 마스터 자산이 없다 — ${name}.jpg`);
  return entry.default;
}

function originalUrl(name: string): string {
  const entry = originalUrls[`../../assets/founding/${name}.jpg`];
  if (!entry) throw new Error(`founding-media: 원본 URL이 없다 — ${name}.jpg`);
  return entry;
}

export interface LightboxEntry {
  id: string;
  type: 'image' | 'video';
  caption: string;
  alt: string;
  /** 화면 맞춤 단계에서 라이트박스가 처음 띄우는 URL. */
  fit: string;
  /** 1:1 확대 계층. zoomable:false 면 null. */
  zoom: string | null;
  /** 새 탭으로 여는 원본(=마스터 해상도 JPEG). zoomable:false 면 null. */
  original: string | null;
  /** 원본 해상도 표기 — "4000 × 3001" */
  natural: string | null;
  videoSrc?: string;
  duration?: string;
}

const FIT_WIDTH = 2000;

export async function buildLightboxEntries(
  items: FoundingMediaItem[],
): Promise<LightboxEntry[]> {
  return Promise.all(
    items.map(async (item): Promise<LightboxEntry> => {
      if (!isImage(item)) {
        return {
          id: item.id,
          type: 'video',
          caption: item.caption,
          alt: item.alt,
          fit: item.src,
          zoom: null,
          original: null,
          natural: null,
          videoSrc: item.src,
          duration: item.duration,
        };
      }

      const src = master(item.src);
      const [fit, zoom] = await Promise.all([
        getImage({ src, width: Math.min(FIT_WIDTH, src.width), format: 'avif', quality: 62 }),
        item.zoomable
          ? getImage({ src, width: src.width, format: 'avif', quality: 60 })
          : Promise.resolve(null),
      ]);

      return {
        id: item.id,
        type: 'image',
        caption: item.caption,
        alt: item.alt,
        fit: fit.src,
        zoom: zoom?.src ?? null,
        // "원본 열기"는 변환 서비스가 다시 압축한 파생본이 아니라, EXIF/GPS를
        // 제거해 커밋한 4000px 마스터의 해시 URL을 그대로 제공한다.
        original: item.zoomable ? originalUrl(item.src) : null,
        natural: item.zoomable ? `${src.width} × ${src.height}` : null,
      };
    }),
  );
}
