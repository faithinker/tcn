// 브라우저측 업로드 사전검사. 서버(validate.ts)가 최종 판정자지만, 여기서 먼저 걸러
// 90MB를 올린 뒤 413/415를 받는 왕복을 없애고 거절 이유를 사람 말로 즉시 보여준다.
// 서버 허용 목록(문서 MIME·비디오 MIME·이미지=WebP)과 짝을 맞춰 유지한다.
import { UPLOAD_LIMITS } from './validate';

// 원본 사진은 업로드 직전 WebP(긴 변 2400px)로 다시 인코딩되므로 서버 이미지 상한보다
// 넉넉하게 받는다. 상한의 목적은 브라우저 디코딩이 죽는 크기를 막는 것.
export const IMAGE_SOURCE_LIMIT = 40 * 1024 * 1024;

export type AcceptedKind = 'image' | 'video' | 'document';

const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
};

const DOCUMENT_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
};

// canvas 로 다시 인코딩할 수 있는 래스터 포맷만. SVG는 벡터라 이 경로로 못 넣는다.
const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
  'avif',
  'bmp',
  'tif',
  'tiff',
]);

const VIDEO_MIME_TYPES = new Set(Object.values(VIDEO_MIME_BY_EXTENSION));
const DOCUMENT_MIME_TYPES = new Set(Object.values(DOCUMENT_MIME_BY_EXTENSION));

export const UPLOAD_ACCEPT_ATTRIBUTE = [
  'image/*',
  ...VIDEO_MIME_TYPES,
  ...Object.keys(DOCUMENT_MIME_BY_EXTENSION).map((extension) => `.${extension}`),
].join(',');

export const UPLOAD_FORMAT_HINT =
  'Photos · Video (MP4, WebM, MOV) · Documents (PDF, Word, Excel, PowerPoint, TXT, CSV)';

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
  if (bytes >= 1024) return `${Number((bytes / 1024).toFixed(1))} KB`;
  return `${bytes} B`;
}

export const UPLOAD_LIMIT_HINT = `Up to ${formatFileSize(IMAGE_SOURCE_LIMIT)} per photo, ${formatFileSize(UPLOAD_LIMITS.video)} per video, ${formatFileSize(UPLOAD_LIMITS.document)} per document`;

export interface UploadCandidate {
  name: string;
  type: string;
  size: number;
}

export type UploadCandidateCheck =
  { ok: true; kind: AcceptedKind; uploadMimeType: string } | { ok: false; reason: string };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

// MIME 우선, 없거나 일반적(application/octet-stream)이면 확장자로 보완한다.
// macOS·Windows 조합에 따라 .doc/.mov 등에서 빈 MIME이 그대로 오는 경우가 있다.
function resolveKind(type: string, name: string): AcceptedKind | null {
  const mime = type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (mime === 'image/svg+xml') return null;
  if (mime.startsWith('image/')) return 'image';
  if (VIDEO_MIME_TYPES.has(mime)) return 'video';
  if (DOCUMENT_MIME_TYPES.has(mime)) return 'document';

  const extension = extensionOf(name);
  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_MIME_BY_EXTENSION[extension]) return 'video';
  if (DOCUMENT_MIME_BY_EXTENSION[extension]) return 'document';
  return null;
}

// 업로드 요청이 선언할 content-type. 이미지는 클라이언트가 WebP로 변환해서 올린다.
function uploadMimeTypeFor(kind: AcceptedKind, type: string, name: string): string {
  if (kind === 'image') return 'image/webp';
  const mime = type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (kind === 'video')
    return VIDEO_MIME_TYPES.has(mime) ? mime : VIDEO_MIME_BY_EXTENSION[extensionOf(name)];
  return DOCUMENT_MIME_TYPES.has(mime) ? mime : DOCUMENT_MIME_BY_EXTENSION[extensionOf(name)];
}

export function uploadSizeLimit(kind: AcceptedKind): number {
  if (kind === 'image') return IMAGE_SOURCE_LIMIT;
  if (kind === 'video') return UPLOAD_LIMITS.video;
  return UPLOAD_LIMITS.document;
}

export function inspectUploadCandidate(file: UploadCandidate): UploadCandidateCheck {
  const kind = resolveKind(file.type, file.name);
  if (!kind) {
    return {
      ok: false,
      reason: `${file.name}: unsupported format. Add photos, MP4/WebM/MOV video, or PDF, Word, Excel, PowerPoint, TXT or CSV documents.`,
    };
  }
  if (file.size <= 0) return { ok: false, reason: `${file.name}: the file is empty.` };

  const limit = uploadSizeLimit(kind);
  if (file.size > limit) {
    return {
      ok: false,
      reason: `${file.name}: ${formatFileSize(file.size)} is over the ${formatFileSize(limit)} limit for a ${kind}.`,
    };
  }

  return { ok: true, kind, uploadMimeType: uploadMimeTypeFor(kind, file.type, file.name) };
}
