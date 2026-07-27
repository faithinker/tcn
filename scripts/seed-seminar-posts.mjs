#!/usr/bin/env node
// 8단계 T1: 기존 세미나 2건(확정 사실만)을 D1 posts 로 이행.
// 고정 UUID + INSERT OR IGNORE 라 몇 번 실행해도 안전(멱등).
//
// 사용법: node scripts/seed-seminar-posts.mjs [--remote]
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// PATH 조회를 거치지 않도록 저장소 안의 실행 파일을 직접 가리킨다(경로가 쓰기 가능하면 하이재킹된다).
// 스크립트 위치 기준이라 어느 디렉터리에서 실행해도 동작한다.
const WRANGLER = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'node_modules',
  '.bin',
  'wrangler',
);

const POSTS = [
  {
    // 제1차 세미나 — 확정: 일자·장소·참여국 (구 seminars.json/history.json en 레코드)
    id: '5a1c9d1e-0001-4d1e-8f00-000000000001',
    title: 'First International Seminar',
    summary: 'Experts from Korea, Vietnam, and Laos convened for the first international seminar.',
    eventDate: '2025-12-26',
    address: 'Luang Prabang, Laos',
    body: 'Participating countries: Korea · Vietnam · Laos.\n\nA detailed report will be published.',
  },
  {
    // 제2차 세미나 — 확정: 일자·장소(TCN 본부). 주제·프로그램 미정 → 기존 공개 폴백 문구.
    id: '5a1c9d1e-0002-4d1e-8f00-000000000002',
    title: 'Second International Seminar',
    summary: 'The second international seminar of the Transcultural Network.',
    eventDate: '2026-10-30',
    address:
      'TCN Headquarters, 286 Gukhwa-ri, Ganghwa-eup, Ganghwa-gun, Incheon, Republic of Korea',
    body: 'The theme and programme will be announced.',
  },
];

const remote = process.argv.includes('--remote');
const browserMedia = process.env.TCN_SEED_BROWSER_MEDIA === '1';
if (remote && browserMedia) {
  throw new Error('TCN_SEED_BROWSER_MEDIA is local-only');
}
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const postSql = POSTS.map(
  (p) =>
    `insert or ignore into posts (id, title, summary, event_date, address, body) values ` +
    `(${lit(p.id)}, ${lit(p.title)}, ${lit(p.summary)}, ${lit(p.eventDate)}, ${lit(p.address)}, ${lit(p.body)});`,
).join('\n');
const mediaSql = browserMedia
  ? `
insert or replace into posts
  (id, title, summary, event_date, address, body)
values
  ('ci-seminar-carousel', 'Carousel Browser Fixture', 'Local browser fixture.', '2099-12-31', 'Test venue', 'Browser fixture.');
insert or replace into media
  (id, post_id, r2_key, kind, mime_type, filename, size, width, height, position, caption)
values
  ('ci-seminar-hero', 'ci-seminar-carousel', 'ci/seminar-hero.jpg', 'image', 'image/jpeg', 'seminar-hero.jpg', 1024, 1600, 1200, 0, 'Seminar opening');
insert or replace into media
  (id, post_id, r2_key, kind, mime_type, filename, size, width, height, position, caption)
values
  ('ci-seminar-discussion', 'ci-seminar-carousel', 'ci/seminar-discussion.jpg', 'image', 'image/jpeg', 'seminar-discussion.jpg', 1024, 1600, 1200, 1, null);
update posts set hero_media_id = 'ci-seminar-hero' where id = 'ci-seminar-carousel';
`
  : '';
const sql = `${postSql}\n${mediaSql}`;

execFileSync(
  WRANGLER,
  ['d1', 'execute', 'tcn-content', remote ? '--remote' : '--local', '--command', sql],
  {
    stdio: 'inherit',
  },
);
console.log(
  `\n✅ seminar posts${browserMedia ? ' + browser media rows' : ''} seeded on ${remote ? 'remote' : 'local'} D1 (idempotent)`,
);
