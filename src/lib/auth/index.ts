// Auth 공개 API. 순수 로직(password/session)은 Node 테스트에서 단독 import 가능하고,
// guard 는 cloudflare:workers env 를 읽으므로 Worker 런타임(라우트)에서만 쓴다.
export { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from './password';
export { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from './session';
export { SESSION_COOKIE, buildSessionCookie, clearSessionCookie, readSessionToken } from './cookie';
export { getSessionUid, getSessionUser, getSessionSecret } from './guard';
export {
  requireActiveAccount,
  requireActiveAccountPage,
  requireExecutive,
  requireExecutivePage,
  requireOfficer,
  requireOfficerMutation,
  requireOfficerPage,
} from './require';
export type { GuardResult } from './require';
export { canAccess, hasTier, meetsRequirement, tierOf, FORUM_MIN_TIER } from './permissions';
export type { Action, ForumBoard, Requirement, SessionUser, Tier } from './permissions';
export {
  createCsrfToken,
  requireMutation,
  requireSameOrigin,
  SecurityError,
  verifyCsrfToken,
} from './mutation';
export type { CsrfScope } from './mutation';
