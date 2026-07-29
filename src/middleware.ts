import { defineMiddleware } from 'astro:middleware';
import { canonicalRedirectTarget } from './lib/canonical-url';

export const onRequest = defineMiddleware(async ({ request, isPrerendered }, next) => {
  const canonical = canonicalRedirectTarget(request, isPrerendered);
  if (canonical) {
    return Response.redirect(canonical, 301);
  }

  const response = await next();
  const pathname = new URL(request.url).pathname;
  if (
    pathname === '/questions' ||
    pathname.startsWith('/questions/') ||
    pathname === '/admin/questions' ||
    pathname.startsWith('/admin/questions/') ||
    pathname === '/api/questions' ||
    pathname.startsWith('/api/questions/')
  ) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Content-Security-Policy',
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    );
  }
  return response;
});
