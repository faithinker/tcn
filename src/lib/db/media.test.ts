import { describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ newId: vi.fn(() => 'new-id') }));

import * as mediaDb from './media';

describe('updateMediaMetadata', () => {
  it('updates caption and position and returns the refreshed media row', async () => {
    const updated = { id: 'm1', caption: 'Seminar discussion', position: 2 };
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const first = vi.fn().mockResolvedValue(updated);
    const bind = vi
      .fn()
      .mockReturnValueOnce({ run })
      .mockReturnValueOnce({ first });
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const updateMediaMetadata = (
      mediaDb as {
        updateMediaMetadata?: (
          db: D1Database,
          id: string,
          input: { caption: string | null; position: number },
        ) => Promise<unknown>;
      }
    ).updateMediaMetadata;

    expect(updateMediaMetadata).toBeTypeOf('function');
    if (!updateMediaMetadata) return;

    await expect(
      updateMediaMetadata(db, 'm1', { caption: 'Seminar discussion', position: 2 }),
    ).resolves.toEqual(updated);
    expect(prepare).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('update media set caption = ?2, position = ?3'),
    );
    expect(bind).toHaveBeenNthCalledWith(1, 'm1', 'Seminar discussion', 2);
  });

  it('returns null when the media row does not exist', async () => {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));
    const db = { prepare } as unknown as D1Database;
    const updateMediaMetadata = (
      mediaDb as {
        updateMediaMetadata?: (
          db: D1Database,
          id: string,
          input: { caption: string | null; position: number },
        ) => Promise<unknown>;
      }
    ).updateMediaMetadata;

    expect(updateMediaMetadata).toBeTypeOf('function');
    if (!updateMediaMetadata) return;

    await expect(updateMediaMetadata(db, 'missing', { caption: null, position: 0 })).resolves.toBeNull();
  });
});
