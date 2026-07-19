import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const siteRoot = site ?? new URL('https://tcn-ezj.pages.dev');
  const seminarSlugs = [
    ...new Set(
      (await getCollection('seminars'))
        .filter((entry) => entry.data.lang === 'ko')
        .map((entry) => entry.data.slug),
    ),
  ];
  const localizedPaths = [
    '/',
    '/about/',
    '/about/founding/',
    '/about/declaration/',
    '/people/',
    '/seminars/',
    ...seminarSlugs.map((slug) => `/seminars/${slug}/`),
    '/contact/',
  ];
  const paths = ['ko', 'en'].flatMap((lang) =>
    localizedPaths.map((path) => path === '/' ? `/${lang}/` : `/${lang}${path}`),
  );

  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, siteRoot).href}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
