import type { APIRoute } from 'astro';
import { getDB, listSeminarPosts } from '../../lib/db';
import { kstToday, seminarFingerprint } from '../../lib/public-content/core';

// 라이브 D1 기준 지문. 배포본(/content-fingerprint.json)과 비교해 정적 페이지가 낡았는지 가린다.
// 해시만 나가고, 워크플로가 10분에 한 번 호출하는 정도라 부담이 없다.
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
