import type { APIRoute } from 'astro';
import { getBucket } from '../../lib/db';

export const prerender = false;

// R2 미디어 공개 서빙(버킷은 비공개 유지). 이미지 렌더·문서/영상 다운로드가 이 경로를 참조.
// 다운로드 강제는 링크의 download 속성(동일 출처)으로 처리.
export const GET: APIRoute = async ({ params }) => {
  const key = params.key;
  if (!key) return new Response('Not found', { status: 404 });

  const object = await getBucket().get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
};
