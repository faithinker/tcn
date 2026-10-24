import { base64UrlEncode, hmacSha256, textEncoder, timingSafeEqual } from '../crypto';
import { readSessionToken } from './cookie';
import { getSessionSecret, getSessionUser } from './guard';
import { meetsRequirement, type Requirement, type SessionUser } from './permissions';

export type CsrfScope = 'qna' | 'forum' | 'users' | 'account' | 'posts';

// Q&A 에서 쓰던 오류 클래스를 공용 이름으로 옮겼다. 오류 코드와 상태 코드 문자열은 그대로다.
export class SecurityError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

// 접두사는 범위별로 `<scope>-csrf:` 다. qna 는 기존 `qna-csrf:` 와 같아서, 배포 전에 열린 관리
// 화면의 토큰이 배포 때문에 무효가 되지 않는다.
export async function createCsrfToken(
  scope: CsrfScope,
  sessionToken: string,
  secret: string,
): Promise<string> {
  return base64UrlEncode(await hmacSha256(`${scope}-csrf:${sessionToken}`, secret));
}

export async function verifyCsrfToken(
  candidate: string,
  scope: CsrfScope,
  sessionToken: string,
  secret: string,
): Promise<boolean> {
  const expected = textEncoder.encode(await createCsrfToken(scope, sessionToken, secret));
  return timingSafeEqual(expected, textEncoder.encode(candidate));
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    throw new SecurityError('invalid_origin', 403);
  }
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new SecurityError('cross_site_request', 403);
  }
}

// 세션, 동일 출처, Fetch Metadata, CSRF 를 차례로 검사한 뒤 역할 조건을 확인한다.
// 앞의 네 단계는 기존 requireAdminMutation 과 순서와 오류 코드가 같다.
export async function requireMutation(
  request: Request,
  options: { scope: CsrfScope; require: Requirement },
  dependencies: {
    getUser?: (request: Request) => Promise<SessionUser | null>;
    sessionSecret?: string;
  } = {},
): Promise<{ user: SessionUser }> {
  const user = await (dependencies.getUser ?? getSessionUser)(request);
  if (!user) throw new SecurityError('unauthorized', 401);

  requireSameOrigin(request);

  const sessionToken = readSessionToken(request);
  if (!sessionToken) throw new SecurityError('unauthorized', 401);
  const csrf = request.headers.get('x-csrf-token') ?? '';
  const secret = dependencies.sessionSecret ?? getSessionSecret();
  if (!csrf || !(await verifyCsrfToken(csrf, options.scope, sessionToken, secret))) {
    throw new SecurityError('invalid_csrf', 403);
  }

  if (!meetsRequirement(user, options.require)) throw new SecurityError('forbidden', 403);
  return { user };
}
