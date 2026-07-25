import type {
  BodyDocument,
  ContentGalleryNode,
  ContentImage,
  PublicPost,
  PublicSeminar,
  SeminarTemporalStatus,
} from './types';

export interface SeminarArticlePresentation {
  body: BodyDocument;
  gallery: ContentImage[];
  status: SeminarTemporalStatus;
  date: string;
  location: string;
  address?: string;
  mapUrl?: string;
}

function googleMapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function imageKey(image: ContentImage): string {
  return image.assetId || image.src || image.path || '';
}

export function prepareSeminarArticle(
  post: PublicPost,
  seminar: PublicSeminar,
): SeminarArticlePresentation {
  const galleryBlocks = post.body.content.filter(
    (block): block is ContentGalleryNode => block.type === 'gallery',
  );
  const body: BodyDocument = {
    ...post.body,
    content: post.body.content.filter((block) => block.type !== 'gallery'),
  };

  const images = galleryBlocks.flatMap((block) => block.attrs.images);
  const heroKey = post.hero ? imageKey(post.hero) : '';
  if (post.hero && !images.some((image) => imageKey(image) === heroKey)) {
    images.unshift(post.hero);
  }

  const seen = new Set<string>();
  const gallery = images.filter((image) => {
    const key = imageKey(image);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 10);
  const address = seminar.address?.trim() || undefined;
  const location = seminar.placeName.trim() || address || '';

  return {
    body,
    gallery,
    status: seminar.temporalStatus,
    date: seminar.startsAt,
    location,
    ...(address ? { address } : {}),
    ...(seminar.mapUrl
      ? { mapUrl: seminar.mapUrl }
      : address || location
        ? { mapUrl: googleMapsSearchUrl(address ?? location) }
        : {}),
  };
}
