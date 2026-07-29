import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createPost,
  getDB,
  getMediaById,
  getPost,
  getSessionUid,
  listSeminarPosts,
  notifyPostChange,
  PostRevisionConflictError,
  softDeletePost,
  updatePost,
} = vi.hoisted(() => ({
  createPost: vi.fn(),
  getDB: vi.fn(() => ({})),
  getMediaById: vi.fn(),
  getPost: vi.fn(),
  getSessionUid: vi.fn(),
  listSeminarPosts: vi.fn(),
  notifyPostChange: vi.fn(),
  PostRevisionConflictError: class PostRevisionConflictError extends Error {
    constructor() {
      super('revision_conflict');
    }
  },
  softDeletePost: vi.fn(),
  updatePost: vi.fn(),
}));

vi.mock('../auth', () => ({ getSessionUid }));
vi.mock('../db', () => ({
  createPost,
  getDB,
  getMediaById,
  getPost,
  listSeminarPosts,
  PostRevisionConflictError,
  softDeletePost,
  updatePost,
}));
vi.mock('../notify', () => ({ notifyPostChange }));

import { DELETE, PUT } from '../../pages/api/posts/[id]';
import { POST } from '../../pages/api/posts/index';

const validPayload = {
  title: '  Third seminar  ',
  summary: '  Summary  ',
  eventDate: '2027-01-15',
  address: '  Seoul  ',
  body: 'Body',
  heroMediaId: null,
};

function createContext(body: unknown = validPayload) {
  return {
    request: new Request('https://tcn.example/api/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<NonNullable<typeof POST>>[0];
}

function itemContext(
  method: 'PUT' | 'DELETE',
  body: unknown = { ...validPayload, revision: 2 },
  id = 'post-1',
) {
  return {
    request: new Request(`https://tcn.example/api/posts/${id}`, {
      method,
      headers: method === 'PUT' ? { 'content-type': 'application/json' } : undefined,
      body: method === 'PUT' ? JSON.stringify(body) : undefined,
    }),
    params: { id },
  } as unknown as Parameters<NonNullable<typeof PUT>>[0];
}

describe('POST /api/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('editor-1');
    listSeminarPosts.mockResolvedValue([]);
    createPost.mockResolvedValue({ id: 'post-1', title: 'Third seminar' });
  });

  it('rejects an unauthenticated request before parsing or opening D1', async () => {
    getSessionUid.mockResolvedValue(null);

    const response = await POST!(createContext());

    expect(response.status).toBe(401);
    expect(getDB).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('creates a normalized seminar and notifies only after persistence', async () => {
    const response = await POST!(createContext());

    expect(response.status).toBe(200);
    expect(createPost).toHaveBeenCalledWith(expect.anything(), {
      title: 'Third seminar',
      summary: 'Summary',
      eventDate: '2027-01-15',
      address: 'Seoul',
      body: 'Body',
      heroMediaId: null,
      authorId: 'editor-1',
    });
    expect(notifyPostChange).toHaveBeenCalledWith(
      'https://tcn.example/api/posts',
      { id: 'post-1', title: 'Third seminar' },
      'created',
    );
  });

  it('rejects a client-assigned cover and a non-sequential event date without writing', async () => {
    const coverResponse = await POST!(
      createContext({ ...validPayload, heroMediaId: 'foreign-media' }),
    );
    expect(coverResponse.status).toBe(400);
    await expect(coverResponse.json()).resolves.toEqual({
      ok: false,
      error: 'hero_media_invalid',
    });

    listSeminarPosts.mockResolvedValue([{ eventDate: '2027-02-01' }]);
    const dateResponse = await POST!(createContext());
    expect(dateResponse.status).toBe(409);
    await expect(dateResponse.json()).resolves.toEqual({
      ok: false,
      error: 'event_date_must_follow_latest',
    });
    expect(createPost).not.toHaveBeenCalled();
    expect(notifyPostChange).not.toHaveBeenCalled();
  });

  it('maps the database unique-date constraint to a stable conflict response', async () => {
    createPost.mockRejectedValue(
      new Error('UNIQUE constraint failed: posts.event_date (idx_posts_visible_event_date)'),
    );

    const response = await POST!(createContext());

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'event_date_conflict',
    });
    expect(notifyPostChange).not.toHaveBeenCalled();
  });
});

describe('PUT /api/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('editor-1');
    getPost.mockResolvedValue({ id: 'post-1', eventDate: '2027-01-15' });
    listSeminarPosts.mockResolvedValue([{ id: 'post-1', eventDate: '2027-01-15' }]);
    updatePost.mockResolvedValue({ id: 'post-1', title: 'Third seminar', revision: 3 });
  });

  it('requires a revision before reading the current post', async () => {
    const response = await PUT!(itemContext('PUT', validPayload));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'invalid_revision' });
    expect(getPost).not.toHaveBeenCalled();
    expect(updatePost).not.toHaveBeenCalled();
  });

  it('rejects a cover that is missing, foreign, or not an image', async () => {
    getMediaById.mockResolvedValue({
      id: 'media-1',
      postId: 'another-post',
      kind: 'image',
    });

    const response = await PUT!(
      itemContext('PUT', { ...validPayload, revision: 2, heroMediaId: 'media-1' }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'hero_media_invalid',
    });
    expect(updatePost).not.toHaveBeenCalled();
    expect(notifyPostChange).not.toHaveBeenCalled();
  });

  it('maps optimistic concurrency conflicts and does not send a stale notification', async () => {
    updatePost.mockRejectedValue(new PostRevisionConflictError());

    const response = await PUT!(itemContext('PUT'));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'revision_conflict',
    });
    expect(notifyPostChange).not.toHaveBeenCalled();
  });

  it('updates the whole post and notifies after a successful write', async () => {
    const response = await PUT!(itemContext('PUT'));

    expect(response.status).toBe(200);
    expect(updatePost).toHaveBeenCalledWith(expect.anything(), 'post-1', {
      title: 'Third seminar',
      summary: 'Summary',
      eventDate: '2027-01-15',
      address: 'Seoul',
      body: 'Body',
      heroMediaId: null,
      expectedRevision: 2,
    });
    expect(notifyPostChange).toHaveBeenCalledWith(
      'https://tcn.example/api/posts/post-1',
      { id: 'post-1', title: 'Third seminar', revision: 3 },
      'updated',
    );
  });
});

describe('DELETE /api/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUid.mockResolvedValue('editor-1');
    softDeletePost.mockResolvedValue(true);
  });

  it('soft-deletes an authenticated post and reports missing rows', async () => {
    const deleted = await DELETE!(itemContext('DELETE'));
    expect(deleted.status).toBe(200);
    expect(softDeletePost).toHaveBeenCalledWith(expect.anything(), 'post-1');

    softDeletePost.mockResolvedValue(false);
    const missing = await DELETE!(itemContext('DELETE'));
    expect(missing.status).toBe(404);
    await expect(missing.json()).resolves.toEqual({ ok: false, error: 'not_found' });
  });
});
