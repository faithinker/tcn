import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 두 스크립트는 core.ts를 Node의 타입 제거로 직접 읽는다.
// 그 파일에 런타임 전용 import가 들어오면 여기서 먼저 깨진다.
const run = promisify(execFile);
const ROOT = path.resolve(__dirname, '..', '..', '..');
const EXPORT = path.join(ROOT, 'scripts', 'export-public-content.mjs');
const FRESHNESS = path.join(ROOT, 'scripts', 'check-static-freshness.mjs');

// 각 테스트가 명시한 환경 변수만 남긴다. 배포 잡은 PRODUCTION_URL·Cloudflare 토큰을 잡 전역 env로 두고
// Actions는 GITHUB_OUTPUT도 채워서, 비우지 않으면 실제 운영 주소 호출이나 출력 파일 쓰기가 일어난다.
const AMBIENT = /^(TCN_|CLOUDFLARE_|FRESHNESS_)|^(PRODUCTION_URL|GITHUB_OUTPUT)$/;
const cleanEnv = (extra: Record<string, string> = {}) =>
  ({
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !AMBIENT.test(key))),
    ...extra,
  }) as NodeJS.ProcessEnv;

const runScript = (script: string, env: NodeJS.ProcessEnv) =>
  run(process.execPath, [script], { env, cwd: ROOT }).then(
    ({ stdout, stderr }) => ({ code: 0, stdout, stderr }),
    (error: { code: number; stdout: string; stderr: string }) => ({
      code: error.code,
      stdout: error.stdout,
      stderr: error.stderr,
    }),
  );

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'tcn-public-content-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('scripts/export-public-content.mjs', { timeout: 30_000 }, () => {
  it('writes an empty snapshot when no content source is available', async () => {
    const output = path.join(dir, 'empty.json');
    const result = await runScript(
      EXPORT,
      cleanEnv({ TCN_CONTENT_SOURCE: 'empty', TCN_CONTENT_OUTPUT: output }),
    );

    expect(result.code).toBe(0);
    expect(result.stdout).toContain('public content: source=empty seminars=0');
    const snapshot = JSON.parse(readFileSync(output, 'utf8'));
    expect(snapshot).toMatchObject({ schema: 1, source: 'empty', posts: [] });
    expect(snapshot.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails the build for production when it cannot read production D1', async () => {
    const output = path.join(dir, 'required.json');
    const result = await runScript(
      EXPORT,
      cleanEnv({ TCN_REQUIRE_CONTENT: '1', TCN_CONTENT_OUTPUT: output }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('needs CLOUDFLARE_API_TOKEN');
    expect(existsSync(output)).toBe(false);
  });

  it('rejects an unknown content source', async () => {
    const result = await runScript(
      EXPORT,
      cleanEnv({ TCN_CONTENT_SOURCE: 'prod', TCN_CONTENT_OUTPUT: path.join(dir, 'bad.json') }),
    );

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('must be remote, local or empty');
  });
});

describe('scripts/check-static-freshness.mjs', { timeout: 30_000 }, () => {
  const docs = { live: '', baked: '' };
  let liveStatus = 200;
  let server: Server;
  let base: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === '/api/content-fingerprint') {
        response.writeHead(liveStatus, { 'content-type': 'application/json' });
        response.end(docs.live);
      } else if (request.url === '/content-fingerprint.json') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(docs.baked);
      } else {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
  });

  const check = async (name: string) => {
    const outputFile = path.join(dir, `${name}.out`);
    const result = await runScript(
      FRESHNESS,
      cleanEnv({ PRODUCTION_URL: base, GITHUB_OUTPUT: outputFile, FRESHNESS_RETRY_DELAY_MS: '0' }),
    );
    return { ...result, output: existsSync(outputFile) ? readFileSync(outputFile, 'utf8') : '' };
  };

  const doc = (fingerprint: string, today: string) => JSON.stringify({ fingerprint, today });

  it('reports up to date when the deployed pages match live D1', async () => {
    liveStatus = 200;
    docs.live = doc('aaa', '2026-10-15');
    docs.baked = doc('aaa', '2026-10-15');

    const result = await check('same');

    expect(result.code).toBe(0);
    expect(result.output).toBe('rebuild=false\nreason=up to date\n');
  });

  it('asks for a rebuild when the seminars changed', async () => {
    liveStatus = 200;
    docs.live = doc('bbb', '2026-10-15');
    docs.baked = doc('aaa', '2026-10-15');

    const result = await check('changed');

    expect(result.code).toBe(0);
    expect(result.output).toBe('rebuild=true\nreason=content changed\n');
  });

  it('asks for a rebuild when the Seoul date rolled over', async () => {
    liveStatus = 200;
    docs.live = doc('ccc', '2026-10-16');
    docs.baked = doc('aaa', '2026-10-15');

    const result = await check('rolled');

    expect(result.output).toBe('rebuild=true\nreason=KST date changed\n');
  });

  it('fails without requesting a rebuild when live D1 is unavailable', async () => {
    liveStatus = 503;
    docs.live = '{"error":"unavailable"}';
    docs.baked = doc('aaa', '2026-10-15');

    const result = await check('live-down');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('live fingerprint responded 503');
    expect(result.output).toBe('');
  });

  it('fails without requesting a rebuild when the deployed fingerprint is not JSON', async () => {
    liveStatus = 200;
    docs.live = doc('aaa', '2026-10-15');
    docs.baked = '<html>Just a moment...</html>';

    const result = await check('baked-html');

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('deployed fingerprint is not JSON');
    expect(result.output).toBe('');
  });

  it('requires PRODUCTION_URL', async () => {
    const result = await runScript(FRESHNESS, cleanEnv());

    expect(result.code).toBe(1);
    expect(result.stderr).toContain('PRODUCTION_URL is required');
  });
});
