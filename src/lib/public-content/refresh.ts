import { env } from 'cloudflare:workers';
import { listSeminarPosts } from '../db';
import { backgroundWait } from '../notify';
import { kstToday, parseFingerprintDoc, seminarFingerprint } from './core';

export interface StaticRefreshConfig {
  githubToken?: string;
  repo?: string;
  fetchFn?: typeof fetch;
}

interface RefreshBindings {
  GITHUB_DISPATCH_TOKEN?: string;
}

export async function requestStaticRefresh(
  db: D1Database,
  siteUrl: string,
  config: StaticRefreshConfig = {},
): Promise<boolean> {
  const token = config.githubToken;
  if (!token) return false;

  const repo = config.repo ?? 'faithinker/tcn';
  const fetcher = config.fetchFn ?? fetch;

  try {
    const today = kstToday();
    const liveFingerprint = await seminarFingerprint(await listSeminarPosts(db), today);

    // Fetch deployed baked fingerprint
    const deployedUrl = new URL('/content-fingerprint.json', siteUrl).toString();
    const deployedRes = await fetcher(deployedUrl, {
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(5000),
    });
    if (!deployedRes.ok) {
      console.warn(`Deployed fingerprint returned ${deployedRes.status}`);
      return false;
    }

    const baked = parseFingerprintDoc(await deployedRes.text(), 'deployed fingerprint');
    if (liveFingerprint === baked.fingerprint) {
      // Content affecting static pages is identical; no deployment needed.
      return false;
    }

    // Trigger GitHub Actions workflow dispatch
    const dispatchUrl = `https://api.github.com/repos/${repo}/actions/workflows/deploy-workers.yml/dispatches`;
    const dispatchRes = await fetcher(dispatchUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'tcn-worker',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
      signal: AbortSignal.timeout(10000),
    });

    if (!dispatchRes.ok && dispatchRes.status !== 204) {
      console.error(
        `Failed to dispatch static refresh workflow: ${dispatchRes.status} ${dispatchRes.statusText}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error('Static refresh dispatch error', error);
    return false;
  }
}

export function triggerStaticRefresh(requestUrl: string, db: D1Database): void {
  const bindings = env as unknown as RefreshBindings;
  const token = bindings?.GITHUB_DISPATCH_TOKEN;
  if (!token) return;

  const siteUrl = new URL(requestUrl).origin;
  backgroundWait(
    requestStaticRefresh(db, siteUrl, {
      githubToken: token,
    }),
  );
}
