import { describe, expect, it, vi } from 'vitest';

import { loadPublicContent, loadPublicContentFromEnvironment } from './adapter';

const fallbackRows = [
  {
    id: 's2026-korea',
    slug: '2026-korea',
    lang: 'ko' as const,
    title: '제2차 세미나',
    date: '2026-10-30',
    status: 'upcoming' as const,
    location: '인천',
  },
  {
    id: 's2025-laos',
    slug: '2025-laos',
    lang: 'ko' as const,
    title: '제1차 세미나',
    date: '2025-12-26',
    status: 'past' as const,
    location: '루앙프라방',
    venue: '회의장',
  },
  {
    id: 's2025-laos-en',
    slug: '2025-laos',
    lang: 'en' as const,
    title: 'First Seminar',
    date: '2025-12-26',
    status: 'past' as const,
    location: 'Luang Prabang',
  },
];

describe('loadPublicContent JSON fallback', () => {
  it('uses the bundled JSON when Supabase is not configured and derives stable sequence numbers', async () => {
    const fetcher = vi.fn<typeof fetch>();

    const content = await loadPublicContent({ fallbackRows, fetcher });

    expect(fetcher).not.toHaveBeenCalled();
    expect(content.source).toBe('json');
    expect(content.posts).toEqual([]);
    expect(content.history.filter(({ kind }) => kind === 'seminar')).toEqual(expect.arrayContaining([
      expect.objectContaining({ locale: 'ko', seminarSequence: 1, title: '제1차 세미나' }),
      expect.objectContaining({ locale: 'en', seminarSequence: 1, title: 'First Seminar' }),
      expect.objectContaining({ locale: 'ko', seminarSequence: 2, title: '제2차 세미나' }),
    ]));
    expect(content.seminars.map(({ locale, sequence, legacySlug }) => ({ locale, sequence, legacySlug }))).toEqual([
      { locale: 'ko', sequence: 1, legacySlug: '2025-laos' },
      { locale: 'en', sequence: 1, legacySlug: '2025-laos' },
      { locale: 'ko', sequence: 2, legacySlug: '2026-korea' },
    ]);
    expect(content.seminars[0]).toMatchObject({
      address: '회의장',
      eventStatus: 'completed',
      temporalStatus: 'past',
    });
  });

  it('uses the importer date-and-slug ordering when events share a date', async () => {
    const content = await loadPublicContent({
      fallbackRows: [
        { ...fallbackRows[0]!, id: 'z', slug: 'z-seminar', title: 'Z', date: '2026-10-30' },
        { ...fallbackRows[0]!, id: 'a', slug: 'a-seminar', title: 'A', date: '2026-10-30' },
      ],
    });

    expect(content.seminars.map(({ legacySlug, sequence }) => ({ legacySlug, sequence }))).toEqual([
      { legacySlug: 'a-seminar', sequence: 1 },
      { legacySlug: 'z-seminar', sequence: 2 },
    ]);
  });
});

describe('loadPublicContent Supabase adapter', () => {
  it('shares one in-flight Supabase snapshot across static route consumers', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json([]));
    vi.stubGlobal('fetch', fetcher);
    const environment = {
      PUBLIC_SUPABASE_URL: 'https://memoized-project.supabase.co',
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'memoized-publishable-key',
    };

    try {
      const [first, second, third] = await Promise.all([
        loadPublicContentFromEnvironment(environment),
        loadPublicContentFromEnvironment(environment),
        loadPublicContentFromEnvironment(environment),
      ]);
      expect(first).toBe(second);
      expect(second).toBe(third);
      expect(fetcher).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('queries published rows, exposes only public localizations, and maps aliases', async () => {
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      requests.push({ url, headers: new Headers(init?.headers) });

      if (url.includes('/seminars?')) {
        return Response.json([
          {
            id: 'seminar-1',
            sequence: 1,
            starts_at: '2025-12-26T01:00:00Z',
            event_status: 'completed',
            place_name: null,
            address: 'Sisavangvong Road',
            legacy_slug: '2025-laos',
            seminar_localizations: [
              {
                locale: 'en',
                title: 'First Seminar',
                place_name: 'Luang Prabang',
                summary: 'A shared gathering',
                content: {
                  mapUrl: 'https://maps.example/luang-prabang',
                  program: ['Opening'],
                  speakers: ['Speaker A'],
                  outcomes: ['Shared question'],
                  materials: [{ label: 'Report', url: '/files/report.pdf' }],
                  photos: [{ src: '/photo.webp', alt: 'Opening discussion' }],
                  tags: ['Laos'],
                },
              },
              { locale: 'ko', title: '제1차 세미나', place_name: '루앙프라방', summary: '함께한 만남' },
            ],
          },
        ]);
      }

      if (url.includes('/posts?')) {
        return Response.json([
          {
            id: 'post-published',
            seminar_id: 'seminar-1',
            post_no: 2,
            kind: 'report',
            workflow_status: 'published',
            published_at: '2026-01-02T10:00:00Z',
            hero_asset_id: 'hero-asset',
            hero_asset: {
              id: 'hero-asset',
              storage_path: 'author-id/hero.webp',
              original_filename: 'hero.webp',
              width: 1800,
              height: 1200,
            },
            post_assets: [{
              asset_id: 'hero-asset',
              role: 'hero',
              post_asset_localizations: [{
                locale: 'en',
                alt_text: 'Delegates at the opening session',
                caption: 'Opening day',
              }],
            }],
            seminars: { sequence: 1 },
            post_localizations: [
              {
                locale: 'en',
                title: 'Activity report',
                excerpt: 'What happened',
                slug: 'activity-report',
                translation_status: 'source',
                body_json: {
                  type: 'doc',
                  attrs: {
                    legacyHistory: {
                      date: '2025-12-26',
                      kind: 'seminar',
                      status: 'past',
                      location: 'Luang Prabang',
                      participants: ['Korea', 'Vietnam', 'Laos'],
                    },
                  },
                  content: [
                    {
                      type: 'gallery',
                      attrs: {
                        layout: 'pair',
                        images: [
                          {
                            id: 'asset-1',
                            path: 'author-id/photo.webp',
                            name: 'photo.webp',
                            alt: 'Participants',
                            width: 1600,
                            height: 1067,
                            aspectRatio: 1.5,
                          },
                        ],
                      },
                    },
                    {
                      type: 'attachments',
                      attrs: {
                        files: [
                          {
                            id: 'file-1',
                            path: 'author-id/report.pdf',
                            name: 'report.pdf',
                            mimeType: 'application/pdf',
                            size: 1024,
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              {
                locale: 'ko',
                title: 'AI draft must stay private',
                slug: 'activity-report',
                translation_status: 'ai_draft',
                body_json: { type: 'doc', content: [] },
              },
            ],
          },
          {
            id: 'post-draft',
            seminar_id: 'seminar-1',
            post_no: 3,
            kind: 'news',
            workflow_status: 'draft',
            seminars: { sequence: 1 },
            post_localizations: [
              {
                locale: 'en',
                title: 'Draft',
                slug: 'draft',
                translation_status: 'source',
                body_json: { type: 'doc', content: [] },
              },
            ],
          },
          {
            id: 'standalone-published-news',
            seminar_id: null,
            post_no: 1,
            kind: 'news',
            workflow_status: 'published',
            seminars: null,
            post_localizations: [
              {
                locale: 'en',
                title: 'Founding news',
                excerpt: 'The Network was founded.',
                slug: 'founding-news',
                translation_status: 'source',
                body_json: {
                  type: 'doc',
                  attrs: {
                    legacyHistory: {
                      date: '2025-12-12',
                      kind: 'founding',
                      status: 'past',
                      location: 'Seoul',
                      participants: ['Experts from 15 countries'],
                    },
                  },
                  content: [],
                },
              },
            ],
          },
        ]);
      }

      return Response.json([
        {
          locale: 'en',
          source_path: '/en/seminars/1/reports/2-old-title',
          destination_path: '/en/seminars/1/reports/2-activity-report',
        },
      ]);
    });

    const content = await loadPublicContent({
      supabaseUrl: 'https://project.supabase.co/',
      supabaseKey: 'publishable-key',
      fetcher,
      fallbackRows,
      now: new Date('2026-07-22T00:00:00Z'),
    });

    expect(content.source).toBe('supabase');
    expect(content.seminars).toHaveLength(2);
    expect(content.seminars.find(({ locale }) => locale === 'en')).toMatchObject({
      mapUrl: 'https://maps.example/luang-prabang',
      program: ['Opening'],
      speakers: ['Speaker A'],
      outcomes: ['Shared question'],
      materials: [{ label: 'Report', url: '/files/report.pdf' }],
      photos: [{ src: '/photo.webp', alt: 'Opening discussion' }],
      tags: ['Laos'],
    });
    expect(content.posts).toEqual([
      expect.objectContaining({
        id: 'post-published',
        locale: 'en',
        seminarSequence: 1,
        postNo: 2,
        translationStatus: 'source',
        hero: {
          assetId: 'hero-asset',
          path: 'author-id/hero.webp',
          src: 'https://project.supabase.co/storage/v1/object/public/seminar-assets/author-id/hero.webp',
          alt: 'Delegates at the opening session',
          caption: 'Opening day',
          width: 1800,
          height: 1200,
          aspectRatio: 1.5,
        },
      }),
      expect.objectContaining({
        id: 'post-published',
        locale: 'ko',
        title: 'Activity report',
        excerpt: 'What happened',
        translationStatus: 'source',
      }),
    ]);
    expect(content.posts[0]?.body).toMatchObject({
      content: [
        {
          attrs: {
            images: [
              {
                assetId: 'asset-1',
                src: 'https://project.supabase.co/storage/v1/object/public/seminar-assets/author-id/photo.webp',
              },
            ],
          },
        },
        {
          attrs: {
            files: [
              {
                assetId: 'file-1',
                url: 'https://project.supabase.co/storage/v1/object/public/seminar-assets/author-id/report.pdf',
              },
            ],
          },
        },
      ],
    });
    expect(content.aliases).toEqual([
      {
        locale: 'en',
        from: '/en/seminars/1/reports/2-old-title',
        to: '/en/seminars/1/reports/2-activity-report',
      },
    ]);
    expect(content.history).toEqual([
      {
        id: 'history-post-published-en',
        locale: 'en',
        date: '2025-12-26',
        kind: 'seminar',
        status: 'past',
        title: 'Activity report',
        location: 'Luang Prabang',
        participants: ['Korea', 'Vietnam', 'Laos'],
        description: 'What happened',
        seminarSequence: 1,
      },
      {
        id: 'history-post-published-ko',
        locale: 'ko',
        date: '2025-12-26',
        kind: 'seminar',
        status: 'past',
        title: 'Activity report',
        location: 'Luang Prabang',
        participants: ['Korea', 'Vietnam', 'Laos'],
        description: 'What happened',
        seminarSequence: 1,
      },
    ]);
    expect(requests).toHaveLength(3);
    expect(requests.some(({ url }) => url.includes('/aliases?'))).toBe(true);
    expect(new URL(requests.find(({ url }) => url.includes('/aliases?'))!.url).searchParams.get('locale')).toBe(
      'in.(ko,en)',
    );
    expect(requests.find(({ url }) => url.includes('/posts?'))?.url).toContain('workflow_status=eq.published');
    expect(requests.find(({ url }) => url.includes('/posts?'))?.url).not.toContain('seminar_id=not.is.null');
    expect(requests.every(({ headers }) => headers.get('apikey') === 'publishable-key')).toBe(true);
  });

  it('fails closed when a required Supabase content query fails after configuration', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes('/posts?')) return new Response('unavailable', { status: 503 });
      return Response.json([]);
    });

    await expect(loadPublicContent({
      supabaseUrl: 'https://project.supabase.co',
      supabaseKey: 'publishable-key',
      fetcher,
      fallbackRows,
    })).rejects.toThrow('Public content request failed with 503');
  });

  it('allows an explicit local-preview opt-in to fall back atomically', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes('/posts?')) return new Response('unavailable', { status: 503 });
      return Response.json([]);
    });

    const content = await loadPublicContent({
      supabaseUrl: 'https://project.supabase.co',
      supabaseKey: 'publishable-key',
      fetcher,
      fallbackRows,
      allowConfiguredFallback: true,
    });

    expect(content.source).toBe('json');
    expect(content.seminars).toHaveLength(3);
  });
});
