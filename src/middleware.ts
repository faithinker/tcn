import { defineMiddleware } from 'astro:middleware';
import { canonicalRedirectTarget } from './lib/canonical-url';

export const onRequest = defineMiddleware(async ({ request, isPrerendered }, next) => {
  const canonical = canonicalRedirectTarget(request, isPrerendered);
  if (canonical) {
    return Response.redirect(canonical, 301);
  }

  return next();
});
