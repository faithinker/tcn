import { describe, expect, it, vi } from 'vitest';
import type { PublicSeminarSnapshot } from '../public-content/core';

const snapshot: PublicSeminarSnapshot = {
  schema: 1,
  source: 'remote',
  generatedAt: '2026-10-15T01:02:03.000Z',
  today: '2026-10-15',
  fingerprint: 'abc123',
  posts: [
    {
      id: 'a',
      title: 'Private title',
      summary: null,
      eventDate: '2026-10-30',
      address: null,
      body: 'Do not publish this body',
      heroMediaId: null,
      authorId: 'author',
      revision: 1,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    },
  ],
};

vi.mock('../public-content/snapshot', () => ({ loadPublicSnapshot: async () => snapshot }));

import { GET } from '../../pages/content-fingerprint.json';

describe('GET /content-fingerprint.json (prerendered)', () => {
  it('publishes only the fingerprint metadata, never the seminar rows', async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(await response.json()).toEqual({
      fingerprint: 'abc123',
      today: '2026-10-15',
      source: 'remote',
      generatedAt: '2026-10-15T01:02:03.000Z',
    });
  });
});
