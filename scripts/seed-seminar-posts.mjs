#!/usr/bin/env node
// 8단계 T1: 기존 세미나 2건(확정 사실만)을 D1 posts 로 이행.
// 고정 UUID + INSERT OR IGNORE 라 몇 번 실행해도 안전(멱등).
//
// 사용법: node scripts/seed-seminar-posts.mjs [--remote]
import { execFileSync } from 'node:child_process';

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
    address: 'TCN Headquarters, 286 Gukhwa-ri, Ganghwa-eup, Ganghwa-gun, Incheon, Republic of Korea',
    body: 'The theme and programme will be announced.',
  },
];

const remote = process.argv.includes('--remote');
const lit = (v) => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const sql = POSTS.map(
  (p) =>
    `insert or ignore into posts (id, title, summary, event_date, address, body) values ` +
    `(${lit(p.id)}, ${lit(p.title)}, ${lit(p.summary)}, ${lit(p.eventDate)}, ${lit(p.address)}, ${lit(p.body)});`,
).join('\n');

execFileSync('npx', ['wrangler', 'd1', 'execute', 'tcn-content', remote ? '--remote' : '--local', '--command', sql], {
  stdio: 'inherit',
});
console.log(`\n✅ seminar posts seeded on ${remote ? 'remote' : 'local'} D1 (idempotent)`);
