import {
  requireUserManager,
  UserChangeError,
  validateUserChange,
  type UserState,
} from './permissions';

export interface ManagedUser extends UserState {
  username: string;
  displayName: string | null;
  affiliation: string | null;
  revision: number;
  createdAt: number;
  decidedAt: number | null;
  decidedBy: string | null;
  decidedByName: string | null;
  canAccessDirectorsForum: boolean;
}
const COLUMNS = `u.id, u.username, u.display_name AS displayName, u.affiliation,
  u.status, u.role, u.is_executive AS isExecutive,
  u.can_access_directors_forum AS canAccessDirectorsForum, u.revision,
  u.created_at AS createdAt, u.decided_at AS decidedAt, u.decided_by AS decidedBy,
  (SELECT COALESCE(a.display_name, a.username) FROM users a WHERE a.id=u.decided_by) AS decidedByName`;
type Row = Omit<ManagedUser, 'isExecutive' | 'canAccessDirectorsForum'> & {
  isExecutive: number;
  canAccessDirectorsForum: number;
};
const mapped = (row: Row): ManagedUser => ({
  ...row,
  isExecutive: row.isExecutive === 1,
  canAccessDirectorsForum: row.canAccessDirectorsForum === 1,
});
export async function getManagedUser(db: D1Database, id: string): Promise<ManagedUser | null> {
  const row = await db.prepare(`SELECT ${COLUMNS} FROM users u WHERE u.id=?`).bind(id).first<Row>();
  return row ? mapped(row) : null;
}
export async function countPendingUsers(db: D1Database): Promise<number> {
  return (
    (
      await db
        .prepare("SELECT COUNT(*) AS count FROM users WHERE status='pending'")
        .first<{ count: number }>()
    )?.count ?? 0
  );
}
export async function listManagedUsers(db: D1Database, options: { status: string; page: number }) {
  if (
    !['pending', 'approved', 'rejected'].includes(options.status) ||
    !Number.isSafeInteger(options.page) ||
    options.page < 1
  )
    throw new UserChangeError('invalid_filter', 400);
  const total =
    (
      await db
        .prepare('SELECT COUNT(*) AS count FROM users WHERE status=?')
        .bind(options.status)
        .first<{ count: number }>()
    )?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(options.page, totalPages);
  const order =
    options.status === 'pending' ? 'u.created_at ASC, u.id ASC' : 'u.decided_at DESC, u.id DESC';
  const result = await db
    .prepare(`SELECT ${COLUMNS} FROM users u WHERE u.status=? ORDER BY ${order} LIMIT 20 OFFSET ?`)
    .bind(options.status, (page - 1) * 20)
    .all<Row>();
  return { items: result.results.map(mapped), page, pageSize: 20 as const, total, totalPages };
}
export interface UserMutationInput {
  actorId: string;
  targetId: string;
  kind: 'status' | 'permissions';
  value: unknown;
  expectedRevision: number;
  requestId: string;
}
interface AuditRow {
  actor_id: string;
  target_id: string;
  request_id: string;
  request_fingerprint: string;
  after_status: string;
  after_role: string;
  after_is_executive: number;
  after_can_access_directors_forum: number;
  after_revision: number;
}
const resultOf = (event: AuditRow) => ({
  id: event.target_id,
  status: event.after_status,
  role: event.after_role,
  isExecutive: event.after_is_executive === 1,
  canAccessDirectorsForum: event.after_can_access_directors_forum === 1,
  revision: event.after_revision,
  requestId: event.request_id,
});
async function fingerprint(input: UserMutationInput): Promise<string> {
  const value = input.value as Record<string, unknown> | null;
  const canonical = JSON.stringify([
    input.kind,
    input.targetId,
    input.expectedRevision,
    input.kind === 'status'
      ? [value?.status]
      : [value?.role, value?.isExecutive, value?.canAccessDirectorsForum],
  ]);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function replay(db: D1Database, input: UserMutationInput, hash: string) {
  const event = await db
    .prepare('SELECT * FROM user_audit_events WHERE request_id=?')
    .bind(input.requestId)
    .first<AuditRow>();
  if (!event) return null;
  if (
    event.actor_id !== input.actorId ||
    event.target_id !== input.targetId ||
    event.request_fingerprint !== hash
  )
    throw new UserChangeError('request_conflict', 409);
  return resultOf(event);
}
export async function mutateUser(db: D1Database, input: UserMutationInput) {
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 1 ||
    typeof input.requestId !== 'string' ||
    !/^[a-zA-Z0-9_-]{8,128}$/.test(input.requestId)
  )
    throw new UserChangeError('invalid_payload', 400);
  requireUserManager(await getManagedUser(db, input.actorId));
  const hash = await fingerprint(input);
  const previous = await replay(db, input, hash);
  if (previous) return previous;
  const target = await getManagedUser(db, input.targetId);
  if (!target) throw new UserChangeError('not_found', 404);
  const actor = await getManagedUser(db, input.actorId);
  requireUserManager(actor);
  const after = validateUserChange(actor, target, input.kind, input.value);
  if (target.revision !== input.expectedRevision)
    throw new UserChangeError('revision_conflict', 409);
  const now = Math.floor(Date.now() / 1000);
  const action =
    input.kind === 'permissions'
      ? 'permissions_changed'
      : target.status === 'rejected'
        ? 'reapproved'
        : after.status;
  const event = {
    actor_id: input.actorId,
    target_id: input.targetId,
    request_id: input.requestId,
    request_fingerprint: hash,
    after_status: after.status,
    after_role: after.role,
    after_is_executive: Number(after.isExecutive),
    after_can_access_directors_forum: Number(after.canAccessDirectorsForum),
    after_revision: target.revision + 1,
  };
  const update = db
    .prepare(
      `UPDATE users SET status=?1,role=?2,is_executive=?3,can_access_directors_forum=?4,revision=revision+1,
    decided_by=CASE WHEN ?5='status' THEN ?6 ELSE decided_by END,
    decided_at=CASE WHEN ?5='status' THEN ?7 ELSE decided_at END
    WHERE id=?8 AND id<>?6 AND revision=?9 AND is_executive=0
      AND status=?10 AND role=?11 AND can_access_directors_forum=?12
      AND EXISTS(SELECT 1 FROM users actor WHERE actor.id=?6 AND actor.status='approved' AND actor.role='officer' AND actor.is_executive=1)`,
    )
    .bind(
      after.status,
      after.role,
      Number(after.isExecutive),
      Number(after.canAccessDirectorsForum),
      input.kind,
      input.actorId,
      now,
      input.targetId,
      input.expectedRevision,
      target.status,
      target.role,
      Number(target.canAccessDirectorsForum),
    );
  const audit = db
    .prepare(
      `INSERT INTO user_audit_events(id,target_id,actor_id,action,before_status,after_status,before_role,after_role,before_is_executive,after_is_executive,before_can_access_directors_forum,after_can_access_directors_forum,before_revision,after_revision,request_id,request_fingerprint,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .bind(
      crypto.randomUUID(),
      input.targetId,
      input.actorId,
      action,
      target.status,
      after.status,
      target.role,
      after.role,
      Number(target.isExecutive),
      Number(after.isExecutive),
      Number(target.canAccessDirectorsForum),
      Number(after.canAccessDirectorsForum),
      target.revision,
      target.revision + 1,
      input.requestId,
      hash,
      now,
    );
  try {
    const results = await db.batch([update, audit]);
    if (results[0].meta.changes !== 1) throw new UserChangeError('revision_conflict', 409);
    return resultOf(event);
  } catch (error) {
    requireUserManager(await getManagedUser(db, input.actorId));
    const retried = await replay(db, input, hash);
    if (retried) return retried;
    const latest = await getManagedUser(db, input.targetId);
    if (!latest) throw new UserChangeError('not_found', 404);
    if (latest.isExecutive || latest.id === input.actorId)
      throw new UserChangeError('protected_user', 403);
    if (
      latest.revision !== input.expectedRevision ||
      /user_change_conflict|UNIQUE constraint/.test(String(error))
    )
      throw new UserChangeError('revision_conflict', 409);
    throw error;
  }
}
