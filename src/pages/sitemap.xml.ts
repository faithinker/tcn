import type { APIRoute } from 'astro';
import { getDB } from '../lib/db';
import { getSeminarCollection } from '../lib/seminar-service';

// 영어 단일 루트 트리: 정적 페이지 + D1 공개 글. SSR(글 즉시 반영).
export const prerender = false;

const STATIC_PATHS = [
  '/',
  '/about',
  '/about/founding',
  '/about/declaration',
  '/about/bylaws',
  '/people',
  '/seminars',
  '/contact',
];

export const GET: APIRoute = async ({ site }) => {
  const siteRoot = site ?? new URL('https://tcn.faithinker12.workers.dev');

  let postPaths: string[] = [];
  try {
    postPaths = (await getSeminarCollection(getDB())).chronological.map((seminar) => seminar.href);
  } catch (error) {
    console.error('sitemap: failed to load seminar routes', error);
    postPaths = [];
  }

  const urls = [...STATIC_PATHS, ...postPaths]
    .map((path) => `  <url><loc>${new URL(path, siteRoot).href}</loc></url>`)
    .join('\n');
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
