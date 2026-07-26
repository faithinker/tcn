import { describe, expect, it } from 'vitest';

import { normalizeMediaMetadata } from './media-metadata';

describe('normalizeMediaMetadata', () => {
  it('trims an optional caption and accepts a non-negative integer position', () => {
    expect(normalizeMediaMetadata({ caption: '  Seminar discussion  ', position: 2 })).toEqual({
      caption: 'Seminar discussion',
      position: 2,
    });
  });

  it('stores an empty caption as null so the public figcaption is omitted', () => {
    expect(normalizeMediaMetadata({ caption: '   ', position: 0 })).toEqual({
      caption: null,
      position: 0,
    });
  });

  it('rejects captions over 500 characters and invalid positions', () => {
    expect(() => normalizeMediaMetadata({ caption: 'x'.repeat(501), position: 0 })).toThrow('caption_too_long');
    expect(() => normalizeMediaMetadata({ caption: null, position: -1 })).toThrow('position_invalid');
    expect(() => normalizeMediaMetadata({ caption: null, position: 1.5 })).toThrow('position_invalid');
  });
});
