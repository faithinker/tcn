import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const siteRoot = site ?? new URL('https://tcn-ezj.pages.dev');
  const invitations = await getCollection('invitations');
  const years = [...new Set(invitations.map((entry) => entry.data.year))];
  const paths = [
    '/',
    '/about/',
    '/about/declaration/',
    '/people/',
    '/events/',
    ...years.map((year) => `/events/${year}/`),
    ...invitations.map((entry) => `/events/${entry.data.year}/${entry.data.slug}/`),
  ];

  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, siteRoot).href}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
