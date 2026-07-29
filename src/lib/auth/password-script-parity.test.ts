import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

// scripts/create-user.mjs 는 빌드 없이 bare node 로 실행되어야 해서 password.ts 를 import 할 수
// 없고, PBKDF2 파라미터를 복제해 갖고 있다. 복제가 갈라져도 저장 포맷이 자기서술형이라
// verifyPassword 는 통과한다 — 대신 발급된 계정만 로그인 때 다른 작업량을 쓰게 되고,
// 값이 커지면 Workers 무료 플랜 CPU 10ms 예산을 넘겨 운영에서만 터진다.
// 아래 단정이 그 조용한 갈라짐을 막는다. 예산 자체의 상한은 password.test.ts 가 잠근다
// (이 파일: 스크립트 == password.ts / password.test.ts: password.ts <= 예산).
const SCRIPT_PATH = new URL('../../../scripts/create-user.mjs', import.meta.url);
const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');

function scriptLiteral(pattern: RegExp, label: string): string {
  const match = SCRIPT.match(pattern);
  if (!match?.[1]) {
    throw new Error(
      `create-user.mjs 에서 ${label} 를 읽지 못했다 — 스크립트 구조가 바뀌었으면 이 테스트도 함께 고쳐야 한다.`,
    );
  }
  return match[1];
}

const script = {
  scheme: scriptLiteral(/return `([a-z0-9]+)\$/, '저장 포맷 scheme'),
  iterations: Number(
    scriptLiteral(/const ITERATIONS = ([\d_]+);/, 'ITERATIONS').replaceAll('_', ''),
  ),
  digest: scriptLiteral(/hash: '([^']+)'/, 'digest'),
  keyBits: Number(scriptLiteral(/keyMaterial,\s*(\d+),/, 'key 길이')),
  saltBytes: Number(scriptLiteral(/getRandomValues\(new Uint8Array\((\d+)\)\)/, 'salt 길이')),
};

async function deriveWithScriptParams(plain: string, salt: Uint8Array): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plain),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: script.iterations,
      hash: script.digest,
    },
    keyMaterial,
    script.keyBits,
  );
  return new Uint8Array(bits);
}

describe('create-user.mjs ↔ password.ts PBKDF2 parity', () => {
  it('reads the parameters the script actually hashes with', () => {
    expect(script).toEqual({
      scheme: 'pbkdf2',
      iterations: expect.any(Number),
      digest: expect.any(String),
      keyBits: expect.any(Number),
      saltBytes: expect.any(Number),
    });
    expect(script.iterations).toBeGreaterThan(0);
  });

  it('hashes with the same scheme, work factor, salt size and key size', async () => {
    const stored = await hashPassword('parity check');
    const [scheme, iterations, saltB64, hashB64] = stored.split('$');

    expect(scheme).toBe(script.scheme);
    expect(Number(iterations)).toBe(script.iterations);
    expect(Buffer.from(saltB64, 'base64')).toHaveLength(script.saltBytes);
    expect(Buffer.from(hashB64, 'base64').length * 8).toBe(script.keyBits);
  });

  it('derives the same digest bytes as password.ts for the same salt', async () => {
    // digest 알고리즘까지 잠근다 — 스크립트가 SHA-512 로 바뀌면 여기서 갈라진다.
    const stored = await hashPassword('parity check');
    const [, , saltB64, hashB64] = stored.split('$');
    const derived = await deriveWithScriptParams(
      'parity check',
      new Uint8Array(Buffer.from(saltB64, 'base64')),
    );

    expect(Buffer.from(derived).toString('base64')).toBe(hashB64);
  });

  it('produces a stored value that verifyPassword accepts', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(script.saltBytes));
    const derived = await deriveWithScriptParams('issued by script', salt);
    const storedByScript = [
      script.scheme,
      script.iterations,
      Buffer.from(salt).toString('base64'),
      Buffer.from(derived).toString('base64'),
    ].join('$');

    expect(await verifyPassword('issued by script', storedByScript)).toBe(true);
    expect(await verifyPassword('wrong password', storedByScript)).toBe(false);
  });
});
