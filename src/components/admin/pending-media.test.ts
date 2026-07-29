import { describe, expect, it } from 'vitest';
import {
  countPendingMedia,
  isPendingMedia,
  mediaPreviewSrc,
  pendingNotice,
  remapMediaIds,
  replacePendingMedia,
} from './pending-media';
import type { EditorMedia, MediaItem, PendingMedia } from './types';

function saved(overrides: Partial<EditorMedia> = {}): EditorMedia {
  return {
    id: 'saved-1',
    r2Key: 'post/one.webp',
    kind: 'image',
    mimeType: 'image/webp',
    filename: 'one.webp',
    width: 100,
    height: 100,
    position: 0,
    caption: null,
    ...overrides,
  };
}

function pending(overrides: Partial<PendingMedia> = {}): PendingMedia {
  return {
    pending: true,
    id: 'pending-1',
    kind: 'image',
    filename: 'two.jpg',
    caption: null,
    uploadMimeType: 'image/webp',
    size: 2_048,
    file: { name: 'two.jpg' } as unknown as File,
    previewUrl: 'blob:preview-two',
    ...overrides,
  };
}

describe('isPendingMedia', () => {
  it('separates staged files from media rows that already exist', () => {
    expect(isPendingMedia(pending())).toBe(true);
    expect(isPendingMedia(saved())).toBe(false);
    expect(countPendingMedia([saved(), pending(), pending({ id: 'pending-2' })])).toBe(2);
  });
});

describe('mediaPreviewSrc', () => {
  it('previews staged images from the local object URL and saved media from R2', () => {
    expect(mediaPreviewSrc(pending())).toBe('blob:preview-two');
    expect(mediaPreviewSrc(saved())).toBe('/media/post/one.webp');
    expect(mediaPreviewSrc(pending({ previewUrl: null }))).toBeNull();
  });
});

describe('replacePendingMedia', () => {
  it('swaps an uploaded file in place so the visible order never shifts', () => {
    const items: MediaItem[] = [pending({ id: 'pending-1' }), saved({ id: 'saved-1' })];
    const uploaded = saved({ id: 'saved-2', r2Key: 'post/two.webp' });

    const next = replacePendingMedia(items, 'pending-1', uploaded);

    expect(next.map((item) => item.id)).toEqual(['saved-2', 'saved-1']);
    expect(items.map((item) => item.id)).toEqual(['pending-1', 'saved-1']);
  });

  it('keeps a caption typed before the upload finished', () => {
    const items: MediaItem[] = [pending({ id: 'pending-1', caption: 'Opening remarks' })];

    const next = replacePendingMedia(items, 'pending-1', saved({ id: 'saved-2' }));

    expect(next[0].caption).toBe('Opening remarks');
  });

  it('leaves the list alone when the pending item is gone', () => {
    const items: MediaItem[] = [saved()];
    expect(replacePendingMedia(items, 'pending-missing', saved({ id: 'saved-2' }))).toEqual(items);
  });
});

describe('remapMediaIds', () => {
  it('moves per-item UI state onto the ids the server assigned', () => {
    const ids = new Map([['pending-1', 'saved-2']]);
    expect(remapMediaIds(new Set(['pending-1', 'saved-1']), ids)).toEqual(
      new Set(['saved-2', 'saved-1']),
    );
  });
});

describe('pendingNotice', () => {
  it('tells the editor that Save is what uploads the staged files', () => {
    expect(pendingNotice(0)).toBe('');
    expect(pendingNotice(1)).toBe('1 file ready. Press Save to upload it.');
    expect(pendingNotice(3)).toBe('3 files ready. Press Save to upload them.');
  });
});
