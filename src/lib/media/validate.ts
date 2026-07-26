import type { MediaKind } from '../db/types';

// 서버측 업로드 검증. 이미지는 클라이언트가 WebP로 정제(옵션 A)해서 올린다는 전제 → WebP 강제.
// 문서/영상은 MIME 허용목록 + 용량. 인증된 내부 사용자 전제라 체크섬까지는 요구하지 않음.

const IMAGE_MAX = 10 * 1024 * 1024; // 10MB
const DOCUMENT_MAX = 20 * 1024 * 1024; // 20MB
const VIDEO_MAX = 200 * 1024 * 1024; // 200MB
const IMAGE_MAX_EDGE = 2400;

const DOCUMENT_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const VIDEO_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

export interface ValidatedUpload {
  kind: MediaKind;
  extension: string;
  width: number | null;
  height: number | null;
}

export class UploadError extends Error {}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}
function le24(bytes: Uint8Array, start: number): number {
  return bytes[start] | (bytes[start + 1] << 8) | (bytes[start + 2] << 16);
}

// WebP 최소 파서: RIFF/WEBP 헤더에서 dimension 추출(아니면 null → 위조 차단).
export function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(bytes, 12, 4);
  if (chunk === 'VP8X') return { width: le24(bytes, 24) + 1, height: le24(bytes, 27) + 1 };
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  }
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height: 1 + (((bytes[22] & 0xc0) >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    };
  }
  return null;
}

export function validateUpload(mime: string, bytes: Uint8Array): ValidatedUpload {
  if (bytes.byteLength <= 0) throw new UploadError('empty_file');

  if (mime === 'image/webp') {
    if (bytes.byteLength > IMAGE_MAX) throw new UploadError('image_too_large');
    const dimensions = webpDimensions(bytes);
    if (!dimensions) throw new UploadError('invalid_webp');
    if (Math.max(dimensions.width, dimensions.height) > IMAGE_MAX_EDGE) {
      throw new UploadError('image_dimensions_too_large');
    }
    return { kind: 'image', extension: 'webp', width: dimensions.width, height: dimensions.height };
  }

  if (DOCUMENT_MIME[mime]) {
    if (bytes.byteLength > DOCUMENT_MAX) throw new UploadError('document_too_large');
    return { kind: 'document', extension: DOCUMENT_MIME[mime], width: null, height: null };
  }

  if (VIDEO_MIME[mime]) {
    if (bytes.byteLength > VIDEO_MAX) throw new UploadError('video_too_large');
    return { kind: 'video', extension: VIDEO_MIME[mime], width: null, height: null };
  }

  throw new UploadError('unsupported_media_type');
}
