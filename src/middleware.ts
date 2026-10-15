import { defineMiddleware } from 'astro:middleware';
import { canonicalRedirectTarget } from './lib/canonical-url';
import { applySecurityHeaders } from './lib/security-headers';

export const onRequest = defineMiddleware(async ({ request, isPrerendered }, next) => {
  const canonical = canonicalRedirectTarget(request, isPrerendered);
  if (canonical) {
    return applySecurityHeaders(Response.redirect(canonical, 301));
  }

  const response = applySecurityHeaders(await next());
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
  }
  return response;
});
