import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const bindings = env as unknown as {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    SESSION_SECRET?: string;
  };
  const { DB: db, MEDIA: media, SESSION_SECRET: sessionSecret } = bindings;

  if (!db || !media || !sessionSecret) {
    return Response.json({ ok: false }, { status: 503 });
  }

  try {
    await db.prepare('select 1 as ok').first();
    await media.head('__tcn_readiness__');
    return Response.json({ ok: true });
  } catch (error) {
    console.error('readiness: dependency check failed', error);
    return Response.json({ ok: false }, { status: 503 });
  }
};
