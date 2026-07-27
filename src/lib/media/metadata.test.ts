import { describe, expect, it } from 'vitest';

import { mediaMetadataForSave, normalizeMediaMetadata } from './metadata';

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
    expect(() => normalizeMediaMetadata({ caption: 'x'.repeat(501), position: 0 })).toThrow(
      'caption_too_long',
    );
    expect(() => normalizeMediaMetadata({ caption: null, position: -1 })).toThrow(
      'position_invalid',
    );
    expect(() => normalizeMediaMetadata({ caption: null, position: 1.5 })).toThrow(
      'position_invalid',
    );
  });
});

describe('mediaMetadataForSave', () => {
  it('keeps optional captions for images', () => {
    expect(mediaMetadataForSave({ kind: 'image', caption: '  Seminar discussion  ' }, 1)).toEqual({
      caption: 'Seminar discussion',
      position: 1,
    });
  });

  it('clears document captions but keeps the required video transcript', () => {
    expect(
      mediaMetadataForSave({ kind: 'document', caption: 'Legacy document caption' }, 2),
    ).toEqual({
      caption: null,
      position: 2,
    });
    expect(
      mediaMetadataForSave({ kind: 'video', caption: '  Speaker welcomes participants.  ' }, 3),
    ).toEqual({
      caption: 'Speaker welcomes participants.',
      position: 3,
    });
  });
});
