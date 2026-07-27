// Auth 공개 API. 순수 로직(password/session)은 Node 테스트에서 단독 import 가능하고,
// guard 는 cloudflare:workers env 를 읽으므로 Worker 런타임(라우트)에서만 쓴다.
//
// 계약 불변식 (2026-07-27 라이브 검증):
// - PBKDF2 iterations = 50,000 고정. Workers Free 10ms CPU 예산에 맞춘 값(실측 ~6.8ms).
//   변경하면 프로덕션 로그인이 CPU 제한으로 죽는다. password.test.ts가 예산을 검증한다.
// - 세션: HMAC 서명 쿠키(tcn_session), HttpOnly·SameSite=Lax·Path=/, TTL 1일.
//   users.session_version 불일치 시 무효(전역 강제 로그아웃 수단).
// - 로그인 시도: 계정·IP 각각 SHA-256 해시 키로 15분/5회 제한 → 초과 시 429.
// - 실패 계약: 잘못된 자격 401, 비JSON 본문 403, 미인증 쓰기 API 401,
//   미인증 /api/auth/me 는 200 + {authenticated:false} (프로브에 정보 노출 없음).
export { hashPassword, verifyPassword } from './password';
export { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from './session';
export { SESSION_COOKIE, buildSessionCookie, clearSessionCookie, readSessionToken } from './cookie';
export { getSessionUid, getSessionSecret } from './guard';
