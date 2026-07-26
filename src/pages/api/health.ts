import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

// 동적 라우트: D1/R2 바인딩이 런타임에 붙는지 확인하는 스모크 엔드포인트.
// Astro 7: 바인딩은 cloudflare:workers 의 env 로 접근 (locals.runtime 제거됨).
export const prerender = false;

export const GET: APIRoute = async () => {
  const bindings = env as unknown as { DB?: D1Database; MEDIA?: R2Bucket };
  const db = bindings.DB;
  const hasMedia = Boolean(bindings.MEDIA);

  try {
    const rs = await db!
      .prepare("select name from sqlite_master where type='table' order by name")
      .all();
    const tables = rs.results.map((row) => (row as { name: string }).name);
    return Response.json({ ok: true, hasDB: true, hasMedia, tables });
  } catch (error) {
    return Response.json(
      { ok: false, hasDB: Boolean(db), hasMedia, error: String(error) },
      { status: 500 },
    );
  }
};
