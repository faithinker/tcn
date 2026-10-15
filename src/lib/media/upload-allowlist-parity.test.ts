import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectUploadCandidate, UPLOAD_ACCEPT_ATTRIBUTE } from './accept';
import { classifyUpload } from './validate';

// accept.ts 와 서버 허용 목록은 따로 적혀 있어 한쪽만 바뀌면 업로드가 415 로 죽거나 파일 선택창이 서버 형식을 안 내준다. 양방향을 잠근다.
const SIZE = 1_024;

const offered = UPLOAD_ACCEPT_ATTRIBUTE.split(',').map((entry) => entry.trim());
const offeredDocumentExtensions = offered
  .filter((entry) => entry.startsWith('.'))
  .map((entry) => entry.slice(1));
const offeredVideoMimes = offered.filter((entry) => entry.startsWith('video/'));

// 서버 허용목록은 모듈 내부 상수라 소스에서 읽는다 — 목록이 사라지면 아래 하한선에서 실패한다.
const VALIDATE = readFileSync(new URL('./validate.ts', import.meta.url), 'utf8');
const serverMimes = [...VALIDATE.matchAll(/^\s*'([a-z]+\/[^']+)':/gm)].map((match) => match[1]);

function accepted(name: string, type: string) {
  const checked = inspectUploadCandidate({ name, type, size: SIZE });
  if (!checked.ok) throw new Error(`클라이언트가 거절했다: ${name} (${type || 'MIME 없음'})`);
  return checked;
}

describe('client accept ↔ server validate allowlist', () => {
  it('parses both allowlists (guards against a silent no-op test)', () => {
    expect(offeredDocumentExtensions.length).toBeGreaterThanOrEqual(9);
    expect(offeredVideoMimes.length).toBeGreaterThanOrEqual(3);
    expect(serverMimes.length).toBeGreaterThanOrEqual(12);
  });

  it('accepts every offered document extension on the server with the same extension', () => {
    for (const extension of offeredDocumentExtensions) {
      // MIME 없이 확장자만 오는 경우(macOS·Windows 조합)까지 같은 경로로 확인한다.
      const checked = accepted(`programme.${extension}`, '');
      const classified = classifyUpload(checked.uploadMimeType, SIZE);
      expect(classified.kind).toBe('document');
      expect(classified.extension).toBe(extension);
    }
  });

  it('accepts every offered video MIME on the server', () => {
    for (const mime of offeredVideoMimes) {
      const checked = accepted('recording.bin', mime);
      expect(checked.kind).toBe('video');
      expect(classifyUpload(checked.uploadMimeType, SIZE).kind).toBe('video');
    }
  });

  it('declares WebP for every raster photo the picker takes', () => {
    for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'avif', 'tif', 'bmp']) {
      const checked = accepted(`photo.${extension}`, '');
      expect(checked.uploadMimeType).toBe('image/webp');
      expect(classifyUpload(checked.uploadMimeType, SIZE)).toMatchObject({
        kind: 'image',
        extension: 'webp',
      });
    }
  });

  it('offers every MIME the server is willing to store', () => {
    for (const mime of serverMimes) {
      const checked = accepted('upload.bin', mime);
      expect(checked.uploadMimeType).toBe(mime);
    }
  });
});
