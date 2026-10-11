-- Phase 4: Application-owned authentication
-- PostgreSQL-native; no Supabase Auth dependency.

CREATE TABLE IF NOT EXISTS aca.auth_credentials (
  user_id uuid PRIMARY KEY REFERENCES aca.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS aca.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES aca.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON aca.auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_active_idx ON aca.auth_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS aca.auth_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_key text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  succeeded boolean NOT NULL DEFAULT false,
  ip_address inet,
  user_agent text
);

CREATE INDEX IF NOT EXISTS auth_login_attempts_subject_time_idx
  ON aca.auth_login_attempts(subject_key, attempted_at DESC);
CREATE INDEX IF NOT EXISTS auth_login_attempts_ip_time_idx
  ON aca.auth_login_attempts(ip_address, attempted_at DESC);

DROP TRIGGER IF EXISTS auth_credentials_updated_at ON aca.auth_credentials;
CREATE TRIGGER auth_credentials_updated_at
  BEFORE UPDATE ON aca.auth_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Authentication records are never exposed to ordinary organization reads.
ALTER TABLE aca.auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE aca.auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE aca.auth_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY auth_credentials_no_direct_read ON aca.auth_credentials
  FOR SELECT USING (false);
CREATE POLICY auth_sessions_no_direct_read ON aca.auth_sessions
  FOR SELECT USING (false);
CREATE POLICY auth_login_attempts_no_direct_read ON aca.auth_login_attempts
  FOR SELECT USING (false);

REVOKE ALL ON aca.auth_credentials FROM PUBLIC;
REVOKE ALL ON aca.auth_sessions FROM PUBLIC;
REVOKE ALL ON aca.auth_login_attempts FROM PUBLIC;
