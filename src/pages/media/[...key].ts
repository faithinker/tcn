import type { APIRoute } from 'astro';
import { getAssets, getBucket, getDB, getPublicMediaByKey, type Media } from '../../lib/db';

export const prerender = false;

function attachmentDisposition(filename: string | null | undefined): string {
  const raw = (filename ?? '').replace(/[\r\n]/g, '').trim() || 'download';
  const ascii =
    raw
      .replace(/[^\x20-\x7e]/g, '')
      .replace(/["\\]/g, '_')
      .trim() || 'download';
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

// R2 미디어 공개 서빙(버킷은 비공개 유지). 이미지 렌더·문서/영상 다운로드가 이 경로를 참조.
function responseHeaders(
  object: R2Object,
  contentLength: number,
  media?: Pick<Media, 'kind' | 'filename'> | null,
): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-length', String(contentLength));
  headers.set('x-content-type-options', 'nosniff');
  if (media?.kind === 'document') {
    headers.set('content-disposition', attachmentDisposition(media.filename));
  }
  // 캐시 정책: 의도적으로 매 뷰 재검증(max-age=0 + must-revalidate).
  // "동의 없는 사진 미노출" 원칙상 사진 삭제·글 soft delete 가 이미 본 브라우저에도 즉시 적용돼야 한다.
  // 비용은 뷰 1건당 Worker 호출·D1 조회·R2 조건부 GET 각 1회라 부하는 '요청 수'다.
  // Workers 요청 수나 D1 읽기가 무료 한도에 근접하면 max-age 300s 로 완화하되, 삭제 반영이 최대 5분 늦어진다.
  headers.set('cache-control', 'public, max-age=0, must-revalidate');
  return headers;
}

function returnedRange(object: R2ObjectBody): { offset: number; length: number } | null {
  const range = object.range;
  if (!range) return null;

  if ('suffix' in range && typeof range.suffix === 'number') {
    const length = Math.min(range.suffix, object.size);
    return { offset: object.size - length, length };
  }

  const offset = 'offset' in range && typeof range.offset === 'number' ? range.offset : 0;
  const length =
    'length' in range && typeof range.length === 'number'
      ? range.length
      : Math.max(0, object.size - offset);
  return { offset, length };
}

function isSupportedRangeHeader(value: string): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return false;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return false;

  const start = rawStart ? Number(rawStart) : null;
  const end = rawEnd ? Number(rawEnd) : null;
  if (start !== null && !Number.isSafeInteger(start)) return false;
  if (end !== null && (!Number.isSafeInteger(end) || end < 1)) return false;
  return start === null || end === null || start <= end;
}

function rangeNotSatisfiable(size?: number): Response {
  const headers = new Headers({ 'accept-ranges': 'bytes' });
  if (size !== undefined) headers.set('content-range', `bytes */${size}`);
  return new Response(null, { status: 416, headers });
}

function resolvedRange(value: string, size: number): { offset: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart) {
    const suffix = Number(rawEnd);
    const length = Math.min(suffix, size);
    return length ? { offset: size - length, length } : null;
  }

  const offset = Number(rawStart);
  if (offset >= size) return null;
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  return { offset, length: end - offset + 1 };
}

const FOUNDING_FILM_KEY = 'founding/founding-ceremony';
const FOUNDING_FILM_ASSET_PATH = '/media/founding/founding-ceremony.mp4';

async function serveFoundingFilm(
  request: Request,
  assets: Fetcher,
  head = false,
): Promise<Response> {
  const assetHeaders = new Headers(request.headers);
  assetHeaders.delete('range');
  const assetRequest = new Request(new URL(FOUNDING_FILM_ASSET_PATH, request.url), {
    method: head ? 'HEAD' : 'GET',
    headers: assetHeaders,
  });
  const asset = await assets.fetch(assetRequest);
  if (!asset.ok) return asset;

  const headers = new Headers(asset.headers);
  headers.set('accept-ranges', 'bytes');
  if (head) return new Response(null, { status: asset.status, headers });

  const rangeHeader = request.headers.get('range');
  if (!rangeHeader || asset.status === 206) {
    return new Response(asset.body, { status: asset.status, headers });
  }

  const body = await asset.arrayBuffer();
  const range = resolvedRange(rangeHeader, body.byteLength);
  if (!range) return rangeNotSatisfiable(body.byteLength);

  headers.set(
    'content-range',
    `bytes ${range.offset}-${range.offset + range.length - 1}/${body.byteLength}`,
  );
  headers.set('content-length', String(range.length));
  return new Response(body.slice(range.offset, range.offset + range.length), {
    status: 206,
    headers,
  });
}

export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });

  const rangeHeader = request.headers.get('range');
  if (rangeHeader && !isSupportedRangeHeader(rangeHeader)) {
    return rangeNotSatisfiable();
  }
  if (key === FOUNDING_FILM_KEY) {
    return serveFoundingFilm(request, getAssets());
  }
  const media = await getPublicMediaByKey(getDB(), key);
  if (!media) {
    return new Response('Not found', { status: 404 });
  }

  const object = await getBucket().get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return new Response('Not found', { status: 404 });
  if (!('body' in object)) {
    const status = request.headers.has('if-none-match') ? 304 : 412;
    return new Response(null, { status, headers: responseHeaders(object, 0, media) });
  }

  const range = request.headers.has('range') ? returnedRange(object) : null;
  if (rangeHeader && !range) return rangeNotSatisfiable(object.size);

  const contentLength = range?.length ?? object.size;
  const headers = responseHeaders(object, contentLength, media);
  if (range) {
    headers.set(
      'content-range',
      `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`,
    );
  }

  return new Response(object.body, { status: range ? 206 : 200, headers });
};

export const HEAD: APIRoute = async ({ params, request }) => {
  const key = params.key;
  if (!key) return new Response(null, { status: 404 });
  if (key === FOUNDING_FILM_KEY) {
    return serveFoundingFilm(request, getAssets(), true);
  }
  const media = await getPublicMediaByKey(getDB(), key);
  if (!media) {
    return new Response(null, { status: 404 });
  }

  const object = await getBucket().head(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 200,
    headers: responseHeaders(object, object.size, media),
  });
};
