-- Preserve author/audit foreign keys while removing login and profile information.
ALTER TABLE users ADD COLUMN deleted_at INTEGER;
ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
CREATE INDEX users_active_status ON users(status,deleted_at);
CREATE TABLE account_events (
 request_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL CHECK(action IN ('withdrawn')),
 created_at INTEGER NOT NULL
);
CREATE TRIGGER account_events_validate BEFORE INSERT ON account_events BEGIN
 SELECT CASE WHEN changes()<>1 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND deleted_at=NEW.created_at)
 THEN RAISE(ABORT,'account_change_conflict') END;
END;
CREATE TABLE account_reauth_failures (
 user_id TEXT NOT NULL REFERENCES users(id),
 session_version INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,session_version)
);
CREATE TABLE auth_email_challenges (
 id TEXT PRIMARY KEY,
 purpose TEXT NOT NULL CHECK(purpose IN ('signup','reset')),
 email TEXT NOT NULL,
 user_id TEXT REFERENCES users(id),
 credential_version INTEGER,
 proof_hash TEXT NOT NULL,
 code_hash TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 verified_at INTEGER,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER,
 created_at INTEGER NOT NULL
);
CREATE INDEX auth_email_challenges_email ON auth_email_challenges(email,purpose,created_at);
CREATE TABLE auth_mail_limits (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 started_at INTEGER NOT NULL,
 last_sent_at INTEGER NOT NULL
);
-- Used only when AUTH_MAIL_MODE=local AND the request hostname is loopback.
CREATE TABLE auth_local_mail (
 id TEXT PRIMARY KEY,
 recipient TEXT NOT NULL,
 subject TEXT NOT NULL,
 body TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE TRIGGER users_erase_auth_proofs AFTER UPDATE OF password_hash,deleted_at ON users
WHEN NEW.password_hash<>OLD.password_hash OR NEW.deleted_at IS NOT NULL BEGIN
 DELETE FROM auth_email_challenges WHERE user_id=NEW.id OR email=OLD.username;
 DELETE FROM account_reauth_failures WHERE user_id=NEW.id;
END;
CREATE TRIGGER users_no_resurrection BEFORE UPDATE ON users
WHEN OLD.deleted_at IS NOT NULL AND (
 NEW.deleted_at IS NULL OR NEW.username<>OLD.username OR NEW.password_hash<>OLD.password_hash
 OR NEW.display_name IS NOT NULL OR NEW.affiliation IS NOT NULL OR NEW.email_verified_at IS NOT NULL
) BEGIN
 SELECT RAISE(ABORT,'withdrawn_account');
END;
