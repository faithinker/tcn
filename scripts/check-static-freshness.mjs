#!/usr/bin/env node
// 배포된 정적 페이지(/content-fingerprint.json)가 라이브 D1(/api/content-fingerprint)과 어긋났는지 판정해
// 다르면 GITHUB_OUTPUT에 rebuild=true 를 쓴다. 가져오기·파싱 실패는 재배포 없이 실패로 끝낸다 —
// 판정 불능을 "달라졌다"로 보면 장애 중에 배포가 반복된다.
import { appendFileSync } from 'node:fs';
import { decideRefresh, parseFingerprintDoc } from '../src/lib/public-content/core.ts';

const base = process.env.PRODUCTION_URL?.replace(/\/+$/, '');
if (!base) {
  console.error('PRODUCTION_URL is required');
  process.exit(1);
}

// 테스트가 재시도 대기를 0으로 줄이려고 쓴다.
const retryDelayMs = Number(process.env.FRESHNESS_RETRY_DELAY_MS ?? 3_000);

async function fetchDoc(pathname, label) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(`${base}${pathname}`, {
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`${label} responded ${response.status}`);
      return parseFingerprintDoc(await response.text(), label);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
  throw lastError;
}

try {
  const live = await fetchDoc('/api/content-fingerprint', 'live fingerprint');
  const baked = await fetchDoc('/content-fingerprint.json', 'deployed fingerprint');
  const { rebuild, reason } = decideRefresh(live, baked);
  console.log(
    `static pages: ${reason} (live ${live.fingerprint.slice(0, 12)} ${live.today}, deployed ${baked.fingerprint.slice(0, 12)} ${baked.today})`,
  );
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `rebuild=${rebuild}\nreason=${reason}\n`);
  }
} catch (error) {
  console.error(`freshness check failed: ${error.message}`);
  process.exit(1);
}
