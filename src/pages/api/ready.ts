import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

export const GET: APIRoute = async () => {
  const bindings = env as unknown as {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    SESSION_SECRET?: string;
    TURNSTILE_SITE_KEY?: string;
    TURNSTILE_SECRET_KEY?: string;
    QNA_TURNSTILE_HOSTNAMES?: string;
    QNA_RATE_LIMIT_SECRET?: string;
  };
  const {
    DB: db,
    MEDIA: media,
    SESSION_SECRET: sessionSecret,
    TURNSTILE_SITE_KEY: turnstileSiteKey,
    TURNSTILE_SECRET_KEY: turnstileSecretKey,
    QNA_TURNSTILE_HOSTNAMES: turnstileHostnames,
    QNA_RATE_LIMIT_SECRET: rateLimitSecret,
  } = bindings;

  if (
    !db ||
    !media ||
    !sessionSecret ||
    !turnstileSiteKey ||
    !turnstileSecretKey ||
    !turnstileHostnames ||
    !rateLimitSecret
  ) {
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
