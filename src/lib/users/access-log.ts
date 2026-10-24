// 관리자 화면의 개인정보 열람 기록(안전성 확보조치 기준 제8조). 보관 기간은 마이그레이션 0012의 트리거와 같아야 한다.
export const ACCESS_LOG_RETENTION_MONTHS = 13;
export const ACCESS_LOG_RETENTION_DAYS = 395;

// 만료 판정은 트리거와 같은 D1 시계로 한다. Worker 시계와 어긋나면 삭제가 트리거에 막혀 열람이 503이 된다.
const EXPIRED = `CAST(strftime('%s', 'now') AS INTEGER) - ${ACCESS_LOG_RETENTION_DAYS} * 86400`;

// 열람 기록 만료분 삭제와 만료된 변경 이력의 처리자 IP 지우기. 기록 때와 예약 정리(maintenance/log-retention)가 같이 쓴다.
export const PURGE_ACCESS_EVENTS_SQL = `DELETE FROM admin_access_events WHERE created_at <= ${EXPIRED}`;
export const CLEAR_AUDIT_IPS_SQL = `UPDATE user_audit_events SET ip=NULL WHERE ip IS NOT NULL AND created_at <= ${EXPIRED}`;

// 접속지는 cf-connecting-ip 원문이다. 로컬 개발에는 헤더가 없어 null이다.
export function accessLogIp(request: Request): string | null {
  const ip = request.headers.get('cf-connecting-ip')?.trim();
  return ip && /^[0-9a-f:.]{2,45}$/i.test(ip) ? ip : null;
}

export interface UsersListView {
  actorId: string;
  ip: string | null;
  status: string;
  page: number;
  subjectIds: string[];
}

// 기록과 만료 삭제를 한 배치로 쓴다. 기록이 실패하면 배치 전체가 되돌려지고 호출자는 화면을 열지 않는다.
export async function recordUsersListView(db: D1Database, view: UsersListView): Promise<void> {
  const subjectIds = [...new Set(view.subjectIds)];
  await db.batch([
    db
      .prepare(
        `INSERT INTO admin_access_events(id,actor_id,action,scope,subject_ids,subject_count,ip,created_at)
    VALUES(?,?,'users_list_viewed',?,?,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        view.actorId,
        `status=${view.status};page=${view.page}`,
        JSON.stringify(subjectIds),
        subjectIds.length,
        view.ip,
        Math.floor(Date.now() / 1000),
      ),
    db.prepare(PURGE_ACCESS_EVENTS_SQL),
    db.prepare(CLEAR_AUDIT_IPS_SQL),
  ]);
}

export const accessLogUnavailable = (): Response =>
  Response.json(
    { ok: false, error: 'access_log_unavailable' },
    {
      status: 503,
      headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'retry-after': '60' },
    },
  );
