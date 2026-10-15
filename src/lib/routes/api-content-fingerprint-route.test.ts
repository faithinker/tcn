import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDB, listSeminarPosts } = vi.hoisted(() => ({
  getDB: vi.fn(() => ({})),
  listSeminarPosts: vi.fn(),
}));

vi.mock('../db', () => ({ getDB, listSeminarPosts }));

import { GET } from '../../pages/api/content-fingerprint';
import { kstToday, seminarFingerprint } from '../public-content/core';

const posts = [
  { id: 'a', title: 'First', summary: null, eventDate: '2025-12-26', address: 'Laos' },
];

describe('GET /api/content-fingerprint', () => {
  beforeEach(() => {
    listSeminarPosts.mockReset();
  });

  it('serves the same fingerprint the static pages were built with, uncached', async () => {
    listSeminarPosts.mockResolvedValue(posts);

    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const today = kstToday();
    expect(await response.json()).toEqual({
      fingerprint: await seminarFingerprint(posts, today),
      today,
    });
  });

  it('answers 503 instead of a fingerprint when D1 is unavailable', async () => {
    listSeminarPosts.mockRejectedValue(new Error('D1 down'));

    const response = await GET({} as Parameters<typeof GET>[0]);

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ error: 'unavailable' });
  });
});
