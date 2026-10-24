import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createPost,
  getDB,
  getMediaById,
  getPost,
  getSessionSecret,
  getSessionUser,
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
  getSessionSecret: vi.fn(() => 'test-secret'),
  getSessionUser: vi.fn(),
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

vi.mock('../auth/guard', () => ({
  getSessionUid: vi.fn(),
  getSessionSecret,
  getSessionUser,
}));
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

import { createCsrfToken } from '../auth/mutation';
import { DELETE, PUT } from '../../pages/api/posts/[id]';
import { POST } from '../../pages/api/posts/index';

const OFFICER = {
  id: 'editor-1',
  username: 'editor',
  displayName: 'Editor',
  role: 'officer',
  status: 'approved',
  isExecutive: false,
} as const;
const MEMBER = { ...OFFICER, id: 'member-1', role: 'member' } as const;
let csrfToken = '';

const validPayload = {
  title: '  Third seminar  ',
  summary: '  Summary  ',
  eventDate: '2027-01-15',
  address: '  Seoul  ',
  body: 'Body',
  heroMediaId: null,
};

function createContext(body: unknown = validPayload, headers: HeadersInit = {}) {
  return {
    request: new Request('https://tcn.example/api/posts', {
      method: 'POST',
      headers: {
        origin: 'https://tcn.example',
        cookie: 'tcn_session=test-session',
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  } as unknown as Parameters<NonNullable<typeof POST>>[0];
}

function itemContext(
  method: 'PUT' | 'DELETE',
  body: unknown = { ...validPayload, revision: 2 },
  id = 'post-1',
  headers: HeadersInit = {},
) {
  return {
    request: new Request(`https://tcn.example/api/posts/${id}`, {
      method,
      headers: {
        origin: 'https://tcn.example',
        cookie: 'tcn_session=test-session',
        'x-csrf-token': csrfToken,
        ...(method === 'PUT' ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: method === 'PUT' ? JSON.stringify(body) : undefined,
    }),
    params: { id },
  } as unknown as Parameters<NonNullable<typeof PUT>>[0];
}

describe('POST /api/posts', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    csrfToken = await createCsrfToken('posts', 'test-session', 'test-secret');
    getSessionUser.mockResolvedValue(OFFICER);
    listSeminarPosts.mockResolvedValue([]);
    createPost.mockResolvedValue({ id: 'post-1', title: 'Third seminar' });
  });

  it('rejects foreign origin, cross-site Fetch Metadata and invalid CSRF before parsing or opening D1', async () => {
    for (const [headers, error] of [
      [{ origin: 'https://evil.example' }, 'invalid_origin'],
      [{ 'sec-fetch-site': 'cross-site' }, 'cross_site_request'],
      [{ 'x-csrf-token': 'forged' }, 'invalid_csrf'],
    ] as const) {
      const response = await POST!(createContext(validPayload, headers));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ ok: false, error });
    }
    expect(getDB).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('rejects a signed-in account that is not an officer before parsing or opening D1', async () => {
    getSessionUser.mockResolvedValue(MEMBER);

    const response = await POST!(createContext());

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ ok: false, error: 'forbidden' });
    expect(getDB).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request before parsing or opening D1', async () => {
    getSessionUser.mockResolvedValue(null);

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
  beforeEach(async () => {
    vi.clearAllMocks();
    csrfToken = await createCsrfToken('posts', 'test-session', 'test-secret');
    getSessionUser.mockResolvedValue(OFFICER);
    getPost.mockResolvedValue({ id: 'post-1', eventDate: '2027-01-15' });
    listSeminarPosts.mockResolvedValue([{ id: 'post-1', eventDate: '2027-01-15' }]);
    updatePost.mockResolvedValue({ id: 'post-1', title: 'Third seminar', revision: 3 });
  });

  it('answers 401 without a session and 403 to a non-officer or missing CSRF before any read', async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await PUT!(itemContext('PUT'))).status).toBe(401);

    getSessionUser.mockResolvedValue(OFFICER);
    expect(
      (
        await PUT!(
          itemContext('PUT', { ...validPayload, revision: 2 }, 'post-1', { 'x-csrf-token': '' }),
        )
      ).status,
    ).toBe(403);

    getSessionUser.mockResolvedValue(MEMBER);
    const response = await PUT!(itemContext('PUT'));
    expect(response.status).toBe(403);
    expect(getPost).not.toHaveBeenCalled();
    expect(updatePost).not.toHaveBeenCalled();
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
  beforeEach(async () => {
    vi.clearAllMocks();
    csrfToken = await createCsrfToken('posts', 'test-session', 'test-secret');
    getSessionUser.mockResolvedValue(OFFICER);
    softDeletePost.mockResolvedValue(true);
  });

  it('answers 401 without a session and 403 to a non-officer or missing CSRF before any write', async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await DELETE!(itemContext('DELETE'))).status).toBe(401);

    getSessionUser.mockResolvedValue(OFFICER);
    expect(
      (await DELETE!(itemContext('DELETE', undefined, 'post-1', { 'x-csrf-token': '' }))).status,
    ).toBe(403);

    getSessionUser.mockResolvedValue(MEMBER);
    const response = await DELETE!(itemContext('DELETE'));
    expect(response.status).toBe(403);
    expect(softDeletePost).not.toHaveBeenCalled();
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
