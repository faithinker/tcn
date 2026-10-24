-- Sign-in log: successful and failed sign-ins, lock events and sign-outs. Rows cannot be changed, and cannot be
-- deleted before the retention window ends: 395 days for approved officers (개인정보의 안전성 확보조치 기준 제8조),
-- 90 days for everyone else. Keep 395 and 90 in sync with AUTH_LOG_STAFF_RETENTION_DAYS and
-- AUTH_LOG_MEMBER_RETENTION_DAYS. user_id is NULL for a sign-in attempt on an unknown account; the typed
-- identifier is never stored.
CREATE TABLE auth_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  event TEXT NOT NULL CHECK(event IN ('login_success', 'login_failure', 'login_locked', 'logout')),
  staff INTEGER NOT NULL CHECK(staff IN (0, 1)),
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX auth_events_time ON auth_events(created_at);
CREATE INDEX auth_events_user ON auth_events(user_id, created_at);

CREATE TRIGGER auth_events_no_update BEFORE UPDATE ON auth_events
BEGIN
  SELECT RAISE(ABORT, 'auth_log_immutable');
END;

CREATE TRIGGER auth_events_no_early_delete BEFORE DELETE ON auth_events
WHEN OLD.created_at > CAST(strftime('%s', 'now') AS INTEGER) - (CASE OLD.staff WHEN 1 THEN 395 ELSE 90 END) * 86400
BEGIN
  SELECT RAISE(ABORT, 'auth_log_retained');
END;
