-- State and audit must be written in one D1 batch: conditional UPDATE, then INSERT.
CREATE TABLE user_audit_events (
  id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES users(id),
  actor_id TEXT NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK(action IN ('approved','rejected','reapproved','permissions_changed')),
  before_status TEXT NOT NULL CHECK(before_status IN ('pending','approved','rejected')),
  after_status TEXT NOT NULL CHECK(after_status IN ('pending','approved','rejected')),
  before_role TEXT NOT NULL CHECK(before_role IN ('member','officer')),
  after_role TEXT NOT NULL CHECK(after_role IN ('member','officer')),
  before_is_executive INTEGER NOT NULL CHECK(before_is_executive IN (0,1)),
  after_is_executive INTEGER NOT NULL CHECK(after_is_executive IN (0,1)),
  before_can_access_directors_forum INTEGER NOT NULL CHECK(before_can_access_directors_forum IN (0,1)),
  after_can_access_directors_forum INTEGER NOT NULL CHECK(after_can_access_directors_forum IN (0,1)),
  before_revision INTEGER NOT NULL CHECK(before_revision >= 1),
  after_revision INTEGER NOT NULL CHECK(after_revision = before_revision + 1),
  request_id TEXT NOT NULL UNIQUE,
  request_fingerprint TEXT NOT NULL CHECK(length(request_fingerprint) = 64),
  created_at INTEGER NOT NULL,
  UNIQUE(target_id, before_revision),
  CHECK(actor_id <> target_id),
  CHECK(before_is_executive = 0),
  CHECK(after_is_executive = 0 OR after_role = 'officer'),
  CHECK(after_can_access_directors_forum = 0 OR after_role = 'member')
);
CREATE INDEX user_audit_events_target_time ON user_audit_events(target_id, created_at DESC, id DESC);

-- changes() is the preceding conditional UPDATE's row count. Snapshot validation also
-- prevents an audit from claiming a change the UPDATE did not actually produce.
CREATE TRIGGER user_audit_events_validate BEFORE INSERT ON user_audit_events
BEGIN
  SELECT CASE WHEN changes() <> 1 THEN RAISE(ABORT, 'user_change_conflict') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.actor_id AND status = 'approved'
      AND role = 'officer' AND is_executive = 1
  ) THEN RAISE(ABORT, 'user_actor_forbidden') END;
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM users WHERE id = NEW.target_id AND revision = NEW.after_revision
      AND status = NEW.after_status AND role = NEW.after_role
      AND is_executive = NEW.after_is_executive
      AND can_access_directors_forum = NEW.after_can_access_directors_forum
  ) THEN RAISE(ABORT, 'user_audit_snapshot_mismatch') END;
  SELECT CASE WHEN NOT (
    (NEW.action = 'permissions_changed' AND NEW.before_status = 'approved' AND NEW.after_status = 'approved')
    OR (NEW.action IN ('approved','rejected','reapproved')
      AND NEW.before_role = NEW.after_role
      AND NEW.before_is_executive = NEW.after_is_executive
      AND NEW.before_can_access_directors_forum = NEW.after_can_access_directors_forum
      AND ((NEW.action = 'approved' AND NEW.before_status = 'pending' AND NEW.after_status = 'approved')
        OR (NEW.action = 'rejected' AND NEW.before_status = 'pending' AND NEW.after_status = 'rejected')
        OR (NEW.action = 'reapproved' AND NEW.before_status = 'rejected' AND NEW.after_status = 'approved')))
  ) THEN RAISE(ABORT, 'user_audit_invalid_transition') END;
END;
