-- Phase 4: email domain foundation.
-- Provider-specific credentials are ciphertext; plaintext tokens never belong in this schema.

DO $$ BEGIN
  CREATE TYPE email_account_provider AS ENUM ('gmail', 'imap_smtp', 'zoho', 'microsoft_graph');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_account_status AS ENUM ('pending', 'connected', 'error', 'disconnected', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_sync_status AS ENUM ('idle', 'running', 'paused', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider email_account_provider NOT NULL,
  email_address citext NOT NULL,
  display_name text,
  status email_account_status NOT NULL DEFAULT 'pending',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_account_id text,
  last_error text,
  connected_at timestamptz,
  last_synced_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS email_accounts_org_address_uniq
  ON email_accounts(organization_id, email_address) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS email_accounts_org_status_idx ON email_accounts(organization_id, status);

CREATE TABLE IF NOT EXISTS email_account_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  credential_version integer NOT NULL DEFAULT 1 CHECK (credential_version > 0),
  ciphertext bytea NOT NULL,
  key_reference text NOT NULL,
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE email_account_credentials
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS email_credentials_org_idx ON email_account_credentials(organization_id);

ALTER TABLE email_folders
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS email_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_folder_id text NOT NULL,
  name text NOT NULL,
  folder_type text,
  parent_folder_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
  unread_count integer NOT NULL DEFAULT 0 CHECK (unread_count >= 0),
  total_count integer NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, provider_folder_id)
);
CREATE INDEX IF NOT EXISTS email_folders_org_idx ON email_folders(organization_id);

ALTER TABLE email_labels
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS email_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_label_id text NOT NULL,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, provider_label_id)
);
CREATE INDEX IF NOT EXISTS email_labels_org_idx ON email_labels(organization_id);

ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS email_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_thread_id text,
  subject text,
  normalized_subject text,
  participant_emails citext[] NOT NULL DEFAULT '{}',
  first_message_at timestamptz,
  last_message_at timestamptz,
  message_count integer NOT NULL DEFAULT 0 CHECK (message_count >= 0),
  snippet text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_threads_provider_uniq
  ON email_threads(email_account_id, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_threads_org_last_message_idx
  ON email_threads(organization_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS email_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES email_threads(id) ON DELETE SET NULL,
  folder_id uuid REFERENCES email_folders(id) ON DELETE SET NULL,
  provider_message_id text NOT NULL,
  provider_uid text,
  internet_message_id text,
  in_reply_to text,
  references_header text,
  from_email citext,
  from_name text,
  to_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  cc_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  bcc_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  reply_to_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  subject text,
  text_body text,
  html_body_sanitized text,
  snippet text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  is_starred boolean NOT NULL DEFAULT false,
  is_draft boolean NOT NULL DEFAULT false,
  is_sent boolean NOT NULL DEFAULT false,
  importance_score numeric(5,4),
  action_required boolean,
  action_deadline timestamptz,
  received_at timestamptz,
  sent_at timestamptz,
  provider_updated_at timestamptz,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(subject,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(from_name,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(text_body,'')), 'C')
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email_account_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS email_messages_org_received_idx
  ON email_messages(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_thread_idx ON email_messages(thread_id, received_at);
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS email_messages_search_idx ON email_messages USING gin(search_vector);
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS from_email text;

CREATE INDEX IF NOT EXISTS email_messages_sender_idx ON email_messages(organization_id, from_email);
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS action_required boolean,
  ADD COLUMN IF NOT EXISTS action_deadline timestamptz;

CREATE INDEX IF NOT EXISTS email_messages_action_idx ON email_messages(organization_id, action_required, received_at DESC);

ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE email_attachments
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS email_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES email_messages(id) ON DELETE CASCADE,
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_attachment_id text,
  filename text NOT NULL,
  content_type text,
  size_bytes bigint CHECK (size_bytes >= 0),
  storage_bucket text,
  storage_path text,
  sha256 text,
  scan_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, provider_attachment_id)
);
CREATE INDEX IF NOT EXISTS email_attachments_org_idx ON email_attachments(organization_id);

ALTER TABLE email_sync_states
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

ALTER TABLE email_sync_states
  ADD COLUMN IF NOT EXISTS status email_sync_status NOT NULL DEFAULT 'idle';

CREATE TABLE IF NOT EXISTS email_sync_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL UNIQUE REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status email_sync_status NOT NULL DEFAULT 'idle',
  cursor text,
  history_id text,
  uid_validity text,
  modseq text,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  error_count integer NOT NULL DEFAULT 0 CHECK (error_count >= 0),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_sync_states_org_status_idx ON email_sync_states(organization_id, status);

CREATE TABLE IF NOT EXISTS email_sync_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account_id uuid NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider_event_id text,
  event_type text NOT NULL,
  payload_hash text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
CREATE UNIQUE INDEX IF NOT EXISTS email_sync_events_provider_event_uniq
  ON email_sync_events(email_account_id, provider_event_id)
  WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS email_sync_events_org_received_idx
  ON email_sync_events(organization_id, received_at DESC);

ALTER TABLE agent_email_accounts
  ADD CONSTRAINT agent_email_accounts_email_account_fk
  FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION update_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER email_accounts_updated_at BEFORE UPDATE ON email_accounts FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER email_account_credentials_updated_at BEFORE UPDATE ON email_account_credentials FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER email_folders_updated_at BEFORE UPDATE ON email_folders FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER email_labels_updated_at BEFORE UPDATE ON email_labels FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER email_threads_updated_at BEFORE UPDATE ON email_threads FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER email_messages_updated_at BEFORE UPDATE ON email_messages FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER email_sync_states_updated_at BEFORE UPDATE ON email_sync_states FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_account_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY email_accounts_member_visibility ON email_accounts FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY email_accounts_admin_manage ON email_accounts FOR ALL TO authenticated
USING (can_manage_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY email_credentials_admin_visibility ON email_account_credentials FOR SELECT TO authenticated
USING (can_manage_organization(organization_id));
CREATE POLICY email_credentials_admin_manage ON email_account_credentials FOR ALL TO authenticated
USING (can_manage_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY email_folders_member_visibility ON email_folders FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY email_folders_member_manage ON email_folders FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY email_labels_member_visibility ON email_labels FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY email_labels_member_manage ON email_labels FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY email_threads_member_visibility ON email_threads FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY email_threads_member_manage ON email_threads FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY email_messages_member_visibility ON email_messages FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY email_messages_member_manage ON email_messages FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY email_attachments_member_visibility ON email_attachments FOR SELECT TO authenticated
USING (can_access_organization(organization_id));
CREATE POLICY email_attachments_member_manage ON email_attachments FOR ALL TO authenticated
USING (can_access_organization(organization_id))
WITH CHECK (can_access_organization(organization_id));

CREATE POLICY email_sync_states_admin_visibility ON email_sync_states FOR SELECT TO authenticated
USING (can_manage_organization(organization_id));
CREATE POLICY email_sync_states_admin_manage ON email_sync_states FOR ALL TO authenticated
USING (can_manage_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));

CREATE POLICY email_sync_events_admin_visibility ON email_sync_events FOR SELECT TO authenticated
USING (can_manage_organization(organization_id));
CREATE POLICY email_sync_events_admin_manage ON email_sync_events FOR ALL TO authenticated
USING (can_manage_organization(organization_id))
WITH CHECK (can_manage_organization(organization_id));
