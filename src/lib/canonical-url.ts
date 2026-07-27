export function canonicalPath(pathname: string): string {
  if (pathname === '/') return pathname;
  let end = pathname.length;
  while (end > 1 && pathname[end - 1] === '/') end -= 1;
  return pathname.slice(0, end);
}

const NON_PAGE_PREFIXES = ['/api/', '/media/', '/_astro/'];

export function canonicalRedirectTarget(request: Request, isPrerendered = false): URL | null {
  if (isPrerendered) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const url = new URL(request.url);
  const pathname = url.pathname;
  if (pathname === '/' || !pathname.endsWith('/')) return null;
  if (NON_PAGE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return null;

  const canonical = canonicalPath(pathname);
  if (/\.[a-z0-9]+$/i.test(canonical)) return null;

  url.pathname = canonical;
  return url;
}
