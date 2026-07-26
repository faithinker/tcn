// 마스터 자산 해석 + 전체 화면 상세보기용 URL 생성.
// 화면 맞춤 파생본은 빌드 타임에 확정해서 DOM 으로 넘긴다.
import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';
import { isImage, type FoundingMediaItem } from '../../lib/founding-media';
import type { LightboxEntry } from '../../lib/media-lightbox';

const masters = import.meta.glob<{ default: ImageMetadata }>('../../assets/founding/*.jpg', {
  eager: true,
});
export function master(name: string): ImageMetadata {
  const entry = masters[`../../assets/founding/${name}.jpg`];
  if (!entry) throw new Error(`founding-media: 마스터 자산이 없다 — ${name}.jpg`);
  return entry.default;
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
          src: item.src,
          duration: item.duration,
        };
      }

      const src = master(item.src);
      const fit = await getImage({
        src,
        width: Math.min(FIT_WIDTH, src.width),
        format: 'avif',
        quality: 62,
      });

      return {
        id: item.id,
        type: 'image',
        caption: item.caption,
        alt: item.alt,
        src: fit.src,
      };
    }),
  );
}
