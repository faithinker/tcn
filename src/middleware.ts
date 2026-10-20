import { defineMiddleware } from 'astro:middleware';
import { canonicalRedirectTarget } from './lib/canonical-url';
import { applySecurityHeaders } from './lib/security-headers';

export const onRequest = defineMiddleware(async ({ request, isPrerendered }, next) => {
  const pathname = new URL(request.url).pathname;
  const memberResponse = [
    '/forum',
    '/api/forum',
    '/admin/users',
    '/api/users',
    '/account',
    '/login',
    '/signup',
    '/api/auth/me',
    '/api/auth/signup',
  ].some((path) => pathname === path || pathname.startsWith(`${path}/`));
  function secure(response: Response): Response {
    const result = applySecurityHeaders(response);
    if (memberResponse) {
      result.headers.set('Cache-Control', 'no-store');
      result.headers.set('X-Robots-Tag', 'noindex');
    }
    return result;
  }
  const canonical = canonicalRedirectTarget(request, isPrerendered);
  if (canonical) {
    return secure(Response.redirect(canonical, 301));
  }

  const response = secure(await next());
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
