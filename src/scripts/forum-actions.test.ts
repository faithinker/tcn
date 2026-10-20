import { describe, expect, it, vi } from 'vitest';
import { mutateForumPost, forumErrorMessage } from './forum-actions';

describe('forum browser mutation contract', () => {
  it('creates via JSON and forum CSRF, preserving plain text', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true, post: { id: 'post-1', revision: 1 } }));
    await expect(
      mutateForumPost(
        { action: 'create', board: 'assembly', title: ' Title ', body: '<b>\nBody', csrf: 'token' },
        fetcher,
      ),
    ).resolves.toBe('/forum/assembly/post-1');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/forum/assembly',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json', 'x-csrf-token': 'token' },
        body: JSON.stringify({ title: 'Title', body: '<b>\nBody' }),
      }),
    );
  });
  it('uses rendered revision for edit and hide and redirects hide to list', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ ok: true, post: { id: 'p', revision: 3 } }));
    await mutateForumPost(
      {
        action: 'edit',
        board: 'directors',
        id: 'p',
        expectedRevision: 2,
        title: 'T',
        body: 'B',
        csrf: 'token',
      },
      fetcher,
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'PUT',
      body: JSON.stringify({ title: 'T', body: 'B', expectedRevision: 2 }),
    });
    fetcher.mockResolvedValue(Response.json({ ok: true }));
    expect(
      await mutateForumPost(
        { action: 'hide', board: 'directors', id: 'p', expectedRevision: 2, csrf: 'token' },
        fetcher,
      ),
    ).toBe('/forum/directors');
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: 'DELETE',
      body: JSON.stringify({ expectedRevision: 2 }),
    });
  });
  it('does not treat HTTP failures or malformed success payloads as saved', async () => {
    for (const response of [
      Response.json({ ok: false, error: 'revision_conflict' }, { status: 409 }),
      new Response('broken'),
      Response.json({ ok: true }),
    ]) {
      await expect(
        mutateForumPost(
          { action: 'create', board: 'assembly', title: 'T', body: 'B', csrf: 'token' },
          async () => response,
        ),
      ).rejects.toThrow();
    }
  });
  it('provides actionable conflict and expired-session messages', () => {
    expect(forumErrorMessage('revision_conflict')).toMatch(/changed|latest/i);
    expect(forumErrorMessage('unauthorized')).toMatch(/sign in/i);
    expect(forumErrorMessage('network_error')).toMatch(/connection/i);
    expect(forumErrorMessage('invalid_input')).toMatch(/title|body/i);
  });
});
