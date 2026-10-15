import type { APIRoute } from 'astro';
import { loadPublicSnapshot } from '../lib/public-content/snapshot';

// 정적 페이지가 어떤 콘텐츠로 구워졌는지 알리는 지문(정적 에셋이라 호출 비용이 없다).
// refresh-static-content 워크플로가 /api/content-fingerprint(라이브)와 비교해 다르면 재배포한다.
export const prerender = true;

export const GET: APIRoute = async () => {
  const { fingerprint, today, source, generatedAt } = await loadPublicSnapshot();
  return Response.json({ fingerprint, today, source, generatedAt });
};
