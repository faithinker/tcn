import { env } from 'cloudflare:workers';
import { getDB, getUserById } from '../db';
import type { User } from '../db';
import { readSessionToken } from './cookie';
import type { SessionUser } from './permissions';
import { verifySessionToken } from './session';

function readSecret(): string | null {
  const value = (env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET;
  return value && value.length > 0 ? value : null;
}

// 서명, 만료, 세션 버전을 모두 통과한 사용자 행. getSessionUid 와 getSessionUser 가 같은 조회를
// 공유하므로 요청당 D1 조회 횟수는 늘지 않는다.
export async function getSessionAccount(request: Request): Promise<User | null> {
  const secret = readSecret();
  if (!secret) return null;
  const token = readSessionToken(request);
  if (!token) return null;
  const result = await verifySessionToken(token, secret);
  if (!result) return null;
  const user = await getUserById(getDB(), result.uid);
  return user && user.sessionVersion === result.sessionVersion ? user : null;
}

export async function getSessionUid(request: Request): Promise<string | null> {
  return (await getSessionAccount(request))?.id ?? null;
}

// 역할, 상태, 결정권은 토큰이 아니라 요청마다 D1 에서 읽는다. 그래서 승인·반려·역할 변경이
// 즉시 반영된다.
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const user = await getSessionAccount(request);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
    isExecutive: user.isExecutive,
    canAccessDirectorsForum: user.canAccessDirectorsForum,
  };
}

export function getSessionSecret(): string {
  const secret = readSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}
