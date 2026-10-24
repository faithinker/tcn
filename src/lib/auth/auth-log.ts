// 로그인 성공·실패·잠금과 로그아웃 기록. 보관 기간은 마이그레이션 0013의 트리거와 같아야 한다.
// 임원(승인된 officer) 계정은 안전성 확보조치 기준 제8조 때문에 13개월, 그 밖의 계정은 보안 점검용으로 90일만 둔다.
import { accessLogIp, ACCESS_LOG_RETENTION_DAYS } from '../users/access-log';

export const AUTH_LOG_STAFF_RETENTION_DAYS = ACCESS_LOG_RETENTION_DAYS;
export const AUTH_LOG_MEMBER_RETENTION_DAYS = 90;

// 만료 판정은 트리거와 같은 D1 시계로 한다.
const NOW = "CAST(strftime('%s', 'now') AS INTEGER)";
const EXPIRED = `(staff = 1 AND created_at <= ${NOW} - ${AUTH_LOG_STAFF_RETENTION_DAYS} * 86400)
  OR (staff = 0 AND created_at <= ${NOW} - ${AUTH_LOG_MEMBER_RETENTION_DAYS} * 86400)`;

export type AuthEvent = 'login_success' | 'login_failure' | 'login_locked' | 'logout';

// 아래 SQL의 staff 판정과 같은 조건이다. 로그인 실패 한도를 정할 때도 이 함수를 쓴다.
export function isStaffAccount(user: { role: string; status: string } | null): boolean {
  return user !== null && user.status === 'approved' && user.role === 'officer';
}

// 이 함수는 던지지 않는다. 실패는 false 로 돌려주고, 입력한 아이디나 IP 없이 실패 사실만 운영 로그에 남긴다.
// attempts 가 2 이상이면 같은 id 로 다시 쓴다. 첫 쓰기가 커밋됐는데 응답만 잃은 경우에 행이 두 줄 생기지 않도록 id 충돌은 무시한다.
// 다른 제약(CHECK 등) 위반은 무시하지 않아 재시도도 실패로 끝난다.
export async function recordAuthEvent(
  db: D1Database,
  event: { userId: string | null; event: AuthEvent; request: Request },
  { attempts = 1 }: { attempts?: number } = {},
): Promise<boolean> {
  const id = crypto.randomUUID();
  const ip = accessLogIp(event.request);
  const createdAt = Math.floor(Date.now() / 1000);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO auth_events(id,user_id,event,staff,ip,created_at)
             SELECT ?1, ?2, ?3,
               EXISTS(SELECT 1 FROM users WHERE id = ?2 AND status = 'approved' AND role = 'officer'),
               ?4, ?5
             WHERE true ON CONFLICT(id) DO NOTHING`,
          )
          .bind(id, event.userId, event.event, ip, createdAt),
        db.prepare(`DELETE FROM auth_events WHERE ${EXPIRED}`),
      ]);
      if (attempt > 1)
        console.warn(JSON.stringify({ event: 'auth_log_retried', kind: event.event }));
      return true;
    } catch {
      // 마지막 시도가 아니면 다시 쓴다.
    }
  }
  console.error(JSON.stringify({ event: 'auth_log_failed', kind: event.event }));
  return false;
}
