import type { APIRoute } from 'astro';
import { getAssets, getBucket, getDB, getPublicMediaByKey } from '../../lib/db';

export const prerender = false;

// R2 미디어 공개 서빙(버킷은 비공개 유지). 이미지 렌더·문서/영상 다운로드가 이 경로를 참조.
// 다운로드 강제는 링크의 download 속성(동일 출처)으로 처리.
function responseHeaders(object: R2Object, contentLength: number): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('content-length', String(contentLength));
  // ── 캐시 정책: 의도적으로 매 뷰 재검증(2026-07-27 결정) ─────────────────────
  // max-age=0 + must-revalidate → 브라우저가 캐시본을 갖고 있어도 매번 물어본다.
  //
  // 왜: "동의 없는 사진 미노출"이 콘텐츠 원칙이다. 사진 삭제나 글 soft delete가
  //     즉시 전역에 적용되어야 하고, 이미 본 브라우저에도 유예 구간이 없어야 한다.
  //     (R2 키는 업로드마다 유일 = 내용은 불변이라, 캐시를 막는 유일한 이유가 '취소'다.)
  //
  // 비용: 뷰 1건당 Worker 호출 1 + D1 조회 1(공개 여부) + R2 조건부 GET 1.
  //     본문은 대개 304로 안 나가므로 대역폭이 아니라 '요청 수'가 부하 지점이다.
  //     갤러리 1페이지에 사진 10장이면 열 때마다 10건.
  //
  // 재검토 신호(둘 중 하나라도 보이면 이 주석으로 돌아올 것):
  //     - Workers 요청 수가 무료 한도(10만/일)의 절반을 상시 넘김
  //     - D1 읽기 행 수가 한도에 근접 (이 경로가 D1 읽기의 최대 소비자)
  // 그때의 완화책: max-age를 300s 정도로 두어 '삭제 반영이 최대 5분 지연'을 감수한다.
  //     지연을 감수하지 못하면 캐시 대신 사진 삭제 시 퍼지(purge) 경로를 먼저 만들어야 한다.
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
  if (!(await getPublicMediaByKey(getDB(), key))) {
    return new Response('Not found', { status: 404 });
  }

  const object = await getBucket().get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return new Response('Not found', { status: 404 });
  if (!('body' in object)) {
    const status = request.headers.has('if-none-match') ? 304 : 412;
    return new Response(null, { status, headers: responseHeaders(object, 0) });
  }

  const range = request.headers.has('range') ? returnedRange(object) : null;
  if (rangeHeader && !range) return rangeNotSatisfiable(object.size);

  const contentLength = range?.length ?? object.size;
  const headers = responseHeaders(object, contentLength);
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
  if (!(await getPublicMediaByKey(getDB(), key))) {
    return new Response(null, { status: 404 });
  }

  const object = await getBucket().head(key);
  if (!object) return new Response(null, { status: 404 });

  return new Response(null, {
    status: 200,
    headers: responseHeaders(object, object.size),
  });
};
