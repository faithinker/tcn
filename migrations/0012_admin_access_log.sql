-- Administrator access log (개인정보의 안전성 확보조치 기준 제8조). Rows cannot be changed, and cannot be
-- deleted before the retention window ends. Keep 395 in sync with ACCESS_LOG_RETENTION_DAYS.
ALTER TABLE user_audit_events ADD COLUMN ip TEXT;
CREATE TABLE admin_access_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('users_list_viewed')),
  scope TEXT NOT NULL,
  subject_ids TEXT NOT NULL,
  subject_count INTEGER NOT NULL CHECK(subject_count >= 0),
  ip TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX admin_access_events_time ON admin_access_events(created_at);
CREATE INDEX admin_access_events_actor ON admin_access_events(actor_id, created_at);

CREATE TRIGGER admin_access_events_validate BEFORE INSERT ON admin_access_events
BEGIN
  SELECT CASE WHEN NOT json_valid(NEW.subject_ids) THEN RAISE(ABORT, 'access_log_invalid_subjects') END;
  SELECT CASE WHEN json_type(NEW.subject_ids) <> 'array'
    OR json_array_length(NEW.subject_ids) <> NEW.subject_count
  THEN RAISE(ABORT, 'access_log_invalid_subjects') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.actor_id AND status = 'approved'
      AND role = 'officer' AND is_executive = 1
  ) THEN RAISE(ABORT, 'access_log_actor_forbidden') END;
END;

CREATE TRIGGER admin_access_events_no_update BEFORE UPDATE ON admin_access_events
BEGIN
  SELECT RAISE(ABORT, 'access_log_immutable');
END;

CREATE TRIGGER admin_access_events_no_early_delete BEFORE DELETE ON admin_access_events
WHEN OLD.created_at > CAST(strftime('%s', 'now') AS INTEGER) - 395 * 86400
BEGIN
  SELECT RAISE(ABORT, 'access_log_retained');
END;
