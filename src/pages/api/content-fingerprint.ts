import type { APIRoute } from 'astro';
import { getDB, listSeminarPosts } from '../../lib/db';
import { kstToday, seminarFingerprint } from '../../lib/public-content/core';

// 라이브 D1 기준 지문. 정적 홈·목록·소개 페이지가 오래됐는지 가리는 비교 대상이다
// (배포된 쪽은 정적 에셋 /content-fingerprint.json). 해시만 나가며 본문·비공개 행은 노출되지 않는다.
// 워크플로가 10분에 한 번 호출하는 정도라 Worker 요청·D1 읽기 부담은 무시할 수준이다.
export const prerender = false;

const NO_STORE = { 'cache-control': 'no-store' };

export const GET: APIRoute = async () => {
  try {
    const today = kstToday();
    const fingerprint = await seminarFingerprint(await listSeminarPosts(getDB()), today);
    return Response.json({ fingerprint, today }, { headers: NO_STORE });
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
};
