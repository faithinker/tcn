// 보관 기간이 지난 접속기록·로그인 기록·변경 이력의 처리자 IP를 지운다. 기록을 쓸 때도 지워지지만, 아무도 로그인하거나
// 사용자 관리 화면을 열지 않으면 기간이 지나도 남으므로 하루 한 번 예약 실행(worker.ts)이 부른다.
// 한 배치라 트리거가 막는 행이 하나라도 걸리면 전부 되돌려진다. 만료 판정은 트리거와 같은 D1 시계다.
import { PURGE_AUTH_EVENTS_SQL } from '../auth/auth-log';
import { CLEAR_AUDIT_IPS_SQL, PURGE_ACCESS_EVENTS_SQL } from '../users/access-log';

export interface LogRetentionResult {
  accessEvents: number;
  authEvents: number;
  auditIps: number;
}

export async function purgeExpiredLogs(db: D1Database): Promise<LogRetentionResult> {
  const [access, auth, audit] = await db.batch([
    db.prepare(PURGE_ACCESS_EVENTS_SQL),
    db.prepare(PURGE_AUTH_EVENTS_SQL),
    db.prepare(CLEAR_AUDIT_IPS_SQL),
  ]);
  return {
    accessEvents: access.meta.changes,
    authEvents: auth.meta.changes,
    auditIps: audit.meta.changes,
  };
}
