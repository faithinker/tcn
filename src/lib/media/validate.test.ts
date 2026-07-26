import { describe, expect, it } from 'vitest';
import { classifyUpload, UploadError, UPLOAD_LIMITS, validateUpload } from './validate';

describe('classifyUpload', () => {
  it('classifies streamable video and document uploads from MIME and declared size', () => {
    expect(classifyUpload('video/mp4', 1_024)).toEqual({
      kind: 'video',
      extension: 'mp4',
      width: null,
      height: null,
    });
    expect(classifyUpload('application/pdf', 1_024).kind).toBe('document');
  });

  it('keeps every upload below the Workers request-body ceiling', () => {
    expect(UPLOAD_LIMITS.video).toBeLessThan(100 * 1024 * 1024);
    expect(() => classifyUpload('video/mp4', UPLOAD_LIMITS.video + 1)).toThrow(
      new UploadError('video_too_large'),
    );
  });

  it('rejects empty, unsafe and unsupported declarations before reading a body', () => {
    expect(() => classifyUpload('video/mp4', 0)).toThrow('empty_file');
    expect(() => classifyUpload('video/mp4', Number.NaN)).toThrow('invalid_file_size');
    expect(() => classifyUpload('application/octet-stream', 1)).toThrow('unsupported_media_type');
  });
});

describe('validateUpload', () => {
  it('still requires image bytes to contain a valid WebP header', () => {
    expect(() => validateUpload('image/webp', new Uint8Array(32))).toThrow('invalid_webp');
  });
});
