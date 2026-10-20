import { getSessionUser } from './guard';
import { requireMutation, requireSameOrigin, SecurityError, type CsrfScope } from './mutation';
import { meetsRequirement, type Requirement, type SessionUser } from './permissions';

export type GuardResult = { ok: true; user: SessionUser } | { ok: false; response: Response };

interface PageContext {
  request: Request;
}

interface PageOptions {
  // 비로그인 방문자를 보낼 곳. 기본값은 어드민 로그인이고, returnTo 가 필요한 화면은 직접 넘긴다.
  loginUrl?: string;
}

function jsonError(error: string, status: number): Response {
  return Response.json({ ok: false, error }, { status });
}

async function guardApi(request: Request, requirement: Requirement): Promise<GuardResult> {
  const user = await getSessionUser(request);
  if (!user) return { ok: false, response: jsonError('unauthorized', 401) };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    try {
      requireSameOrigin(request);
    } catch (error) {
      if (error instanceof SecurityError) {
        return { ok: false, response: jsonError(error.code, error.status) };
      }
      throw error;
    }
  }
  if (!meetsRequirement(user, requirement)) {
    return { ok: false, response: jsonError('forbidden', 403) };
  }
  return { ok: true, user };
}

export async function requireOfficerMutation(
  request: Request,
  scope: CsrfScope = 'posts',
): Promise<GuardResult> {
  try {
    const { user } = await requireMutation(request, { scope, require: 'officer' });
    return { ok: true, user };
  } catch (error) {
    if (error instanceof SecurityError) {
      return { ok: false, response: jsonError(error.code, error.status) };
    }
    throw error;
  }
}

// 안내 화면은 3단계의 /account 와 함께 생긴다. 그때까지는 일반 텍스트로 답한다.
async function guardPage(
  context: PageContext,
  requirement: Requirement,
  options: PageOptions = {},
): Promise<GuardResult> {
  const user = await getSessionUser(context.request);
  if (!user) {
    const location = options.loginUrl ?? '/admin/login';
    return { ok: false, response: new Response(null, { status: 302, headers: { location } }) };
  }
  if (!meetsRequirement(user, requirement)) {
    return {
      ok: false,
      response: new Response('Forbidden', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      }),
    };
  }
  return { ok: true, user };
}

export function requireOfficer(request: Request): Promise<GuardResult> {
  return guardApi(request, 'officer');
}

export function requireExecutive(request: Request): Promise<GuardResult> {
  return guardApi(request, 'executive');
}

export function requireActiveAccount(request: Request): Promise<GuardResult> {
  return guardApi(request, 'activeAccount');
}

export function requireOfficerPage(
  context: PageContext,
  options?: PageOptions,
): Promise<GuardResult> {
  return guardPage(context, 'officer', options);
}

export function requireExecutivePage(
  context: PageContext,
  options?: PageOptions,
): Promise<GuardResult> {
  return guardPage(context, 'executive', options);
}

export function requireActiveAccountPage(
  context: PageContext,
  options?: PageOptions,
): Promise<GuardResult> {
  return guardPage(context, 'activeAccount', options);
}
