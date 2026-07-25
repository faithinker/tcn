import { describe, expect, it } from 'vitest';
import { prepareSeminarArticle } from './article-layout';
import type { PublicPost, PublicSeminar } from './types';

const seminar: PublicSeminar = {
  id: 'seminar-1',
  sequence: 1,
  locale: 'en',
  title: 'First seminar',
  startsAt: '2025-12-26T00:00:00.000Z',
  eventStatus: 'completed',
  temporalStatus: 'past',
  placeName: 'Luang Prabang, Laos',
  address: 'Luang Prabang, Laos',
  mapUrl: 'https://maps.example/luang-prabang',
};

function post(overrides: Partial<PublicPost> = {}): PublicPost {
  return {
    id: 'post-1',
    seminarId: seminar.id,
    seminarSequence: 1,
    postNo: 1,
    kind: 'activity',
    locale: 'en',
    title: 'First International Seminar',
    excerpt: 'A concise seminar summary.',
    slug: 'first-international-seminar',
    body: {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Opening.' }] },
        {
          type: 'gallery',
          attrs: {
            layout: 'pair',
            images: Array.from({ length: 10 }, (_, index) => ({
              assetId: `image-${index}`,
              src: `/image-${index}.webp`,
              alt: `Image ${index}`,
              width: 1200,
              height: 800,
            })),
          },
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Closing.' }] },
      ],
    },
    hero: {
      assetId: 'image-0',
      src: '/image-0.webp',
      alt: 'Image 0',
      width: 1200,
      height: 800,
    },
    publishedAt: '2026-07-25T00:00:00.000Z',
    translationStatus: 'source',
    ...overrides,
  };
}

describe('seminar article presentation', () => {
  it('moves all gallery photos to one bottom gallery while preserving story order', () => {
    const result = prepareSeminarArticle(post(), seminar);

    expect(result.body.content.map((block) => block.type)).toEqual(['paragraph', 'paragraph']);
    expect(result.gallery.map((image) => image.assetId)).toEqual(
      Array.from({ length: 10 }, (_, index) => `image-${index}`),
    );
  });

  it('includes a standalone hero in the bottom gallery once and caps the result at ten', () => {
    const result = prepareSeminarArticle(post({
      hero: {
        assetId: 'hero-only',
        src: '/hero.webp',
        alt: 'Hero',
        width: 1600,
        height: 900,
      },
    }), seminar);

    expect(result.gallery).toHaveLength(10);
    expect(result.gallery[0]?.assetId).toBe('hero-only');
    expect(new Set(result.gallery.map((image) => image.assetId)).size).toBe(10);
  });

  it('uses event metadata for the header and facts fallback', () => {
    const result = prepareSeminarArticle(post(), { ...seminar, mapUrl: undefined });

    expect(result.status).toBe('past');
    expect(result.date).toBe(seminar.startsAt);
    expect(result.location).toBe('Luang Prabang, Laos');
    expect(result.address).toBe('Luang Prabang, Laos');
    expect(result.mapUrl).toContain('google.com/maps/search');
  });
});
