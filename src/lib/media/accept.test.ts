import { describe, expect, it } from 'vitest';
import {
  formatFileSize,
  IMAGE_SOURCE_LIMIT,
  inspectUploadCandidate,
  UPLOAD_ACCEPT_ATTRIBUTE,
  UPLOAD_LIMIT_HINT,
} from './accept';
import { UPLOAD_LIMITS } from './validate';

function candidate(overrides: Partial<{ name: string; type: string; size: number }> = {}) {
  return { name: 'clip.mp4', type: 'video/mp4', size: 1_024, ...overrides };
}

describe('inspectUploadCandidate', () => {
  it('accepts photos, video and documents and reports the MIME the upload will declare', () => {
    expect(inspectUploadCandidate(candidate())).toEqual({
      ok: true,
      kind: 'video',
      uploadMimeType: 'video/mp4',
    });
    expect(
      inspectUploadCandidate(
        candidate({
          name: 'programme.docx',
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ),
    ).toEqual({
      ok: true,
      kind: 'document',
      uploadMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    // 이미지는 업로드 직전 WebP로 다시 인코딩되므로 선언 MIME도 WebP다.
    expect(inspectUploadCandidate(candidate({ name: 'photo.JPG', type: 'image/jpeg' }))).toEqual({
      ok: true,
      kind: 'image',
      uploadMimeType: 'image/webp',
    });
  });

  it('falls back to the extension when the browser reports no MIME type', () => {
    expect(inspectUploadCandidate(candidate({ name: 'talk.MOV', type: '' }))).toEqual({
      ok: true,
      kind: 'video',
      uploadMimeType: 'video/quicktime',
    });
    expect(
      inspectUploadCandidate(candidate({ name: 'notes.csv', type: 'application/octet-stream' })),
    ).toEqual({ ok: true, kind: 'document', uploadMimeType: 'text/csv' });
    expect(inspectUploadCandidate(candidate({ name: 'scan.heic', type: '' })).ok).toBe(true);
  });

  it('rejects formats the pipeline cannot store, naming the file', () => {
    const svg = inspectUploadCandidate(candidate({ name: 'logo.svg', type: 'image/svg+xml' }));
    expect(svg.ok).toBe(false);
    expect(svg.ok === false && svg.reason).toContain('logo.svg');
    expect(inspectUploadCandidate(candidate({ name: 'app.zip', type: 'application/zip' })).ok).toBe(
      false,
    );
    expect(
      inspectUploadCandidate(candidate({ name: 'clip.avi', type: 'video/x-msvideo' })).ok,
    ).toBe(false);
  });

  it('rejects empty files and files above the limit for their kind', () => {
    expect(inspectUploadCandidate(candidate({ size: 0 })).ok).toBe(false);
    expect(inspectUploadCandidate(candidate({ size: UPLOAD_LIMITS.video })).ok).toBe(true);
    expect(inspectUploadCandidate(candidate({ size: UPLOAD_LIMITS.video + 1 })).ok).toBe(false);

    const document = { name: 'deck.pdf', type: 'application/pdf' };
    expect(inspectUploadCandidate({ ...document, size: UPLOAD_LIMITS.document + 1 }).ok).toBe(
      false,
    );

    // 원본 사진은 클라이언트 축소·WebP 변환을 거치므로 서버 이미지 상한보다 관대하다.
    const photo = { name: 'photo.jpg', type: 'image/jpeg' };
    expect(IMAGE_SOURCE_LIMIT).toBeGreaterThan(UPLOAD_LIMITS.image);
    expect(inspectUploadCandidate({ ...photo, size: UPLOAD_LIMITS.image + 1 }).ok).toBe(true);
    expect(inspectUploadCandidate({ ...photo, size: IMAGE_SOURCE_LIMIT + 1 }).ok).toBe(false);
  });

  it('explains the limit in the rejection reason', () => {
    const rejected = inspectUploadCandidate(candidate({ size: UPLOAD_LIMITS.video + 1 }));
    expect(rejected.ok === false && rejected.reason).toContain('90 MB');
  });
});

describe('upload hints', () => {
  it('formats sizes without noisy decimals', () => {
    expect(formatFileSize(90 * 1024 * 1024)).toBe('90 MB');
    expect(formatFileSize(1_500_000)).toBe('1.4 MB');
    expect(formatFileSize(2_048)).toBe('2 KB');
    expect(formatFileSize(12)).toBe('12 B');
  });

  it('offers every accepted kind to the file picker', () => {
    expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain('image/*');
    expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain('video/mp4');
    expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain('.docx');
    expect(UPLOAD_ACCEPT_ATTRIBUTE).toContain('.pdf');
  });

  it('states the limits shown next to the dropzone', () => {
    expect(UPLOAD_LIMIT_HINT).toContain(formatFileSize(UPLOAD_LIMITS.video));
    expect(UPLOAD_LIMIT_HINT).toContain(formatFileSize(UPLOAD_LIMITS.document));
  });
});
