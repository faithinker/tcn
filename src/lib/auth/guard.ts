import { env } from 'cloudflare:workers';
import { getDB, getUserById } from '../db';
import { readSessionToken } from './cookie';
import { verifySessionToken } from './session';

function readSecret(): string | null {
  const value = (env as unknown as { SESSION_SECRET?: string }).SESSION_SECRET;
  return value && value.length > 0 ? value : null;
}

// 요청 쿠키에서 로그인한 사용자 id 를 얻는다. 없거나 무효/만료면 null.
export async function getSessionUid(request: Request): Promise<string | null> {
  const secret = readSecret();
  if (!secret) return null;
  const token = readSessionToken(request);
  if (!token) return null;
  const result = await verifySessionToken(token, secret);
  if (!result) return null;
  const user = await getUserById(getDB(), result.uid);
  return user?.sessionVersion === result.sessionVersion ? result.uid : null;
}

export function getSessionSecret(): string {
  const secret = readSecret();
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return secret;
}
