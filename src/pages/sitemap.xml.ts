import type { APIRoute } from 'astro';
import { createSitemapPaths, loadPublicContentFromEnvironment } from '../lib/content';

export const GET: APIRoute = async ({ site }) => {
  const siteRoot = site ?? new URL('https://tcn-ezj.pages.dev');
  const content = await loadPublicContentFromEnvironment(import.meta.env);
  const paths = createSitemapPaths(content);

  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, siteRoot).href}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
