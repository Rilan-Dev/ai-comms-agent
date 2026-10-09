-- Reconcile legacy/partially-created email_messages with the canonical mail
-- repository and worker persistence contract. Safe to apply repeatedly.
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS from_email text,
  ADD COLUMN IF NOT EXISTS from_name text,
  ADD COLUMN IF NOT EXISTS to_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cc_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS bcc_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reply_to_recipients jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS references_header text,
  ADD COLUMN IF NOT EXISTS html_body_sanitized text,
  ADD COLUMN IF NOT EXISTS headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS labels jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_draft_id text,
  ADD COLUMN IF NOT EXISTS provider_draft_sync_status text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS provider_draft_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_draft_last_error text,
  ADD COLUMN IF NOT EXISTS action_required boolean,
  ADD COLUMN IF NOT EXISTS importance_score numeric(5,4),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Migrate legacy names only when those columns exist. Avoid overwriting canonical
-- values already written by newer application versions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'from_address'
  ) THEN
    -- The legacy schema made from_address mandatory; current writes use from_email.
    EXECUTE 'ALTER TABLE email_messages ALTER COLUMN from_address DROP NOT NULL';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'from_address'
  ) THEN
    EXECUTE 'UPDATE email_messages SET from_email = COALESCE(from_email, from_address) WHERE from_email IS NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'to_addresses'
  ) THEN
    EXECUTE 'UPDATE email_messages SET to_recipients = to_addresses WHERE to_recipients = ''[]''::jsonb AND to_addresses IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'cc_addresses'
  ) THEN
    EXECUTE 'UPDATE email_messages SET cc_recipients = cc_addresses WHERE cc_recipients = ''[]''::jsonb AND cc_addresses IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'bcc_addresses'
  ) THEN
    EXECUTE 'UPDATE email_messages SET bcc_recipients = bcc_addresses WHERE bcc_recipients = ''[]''::jsonb AND bcc_addresses IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'is_outbound'
  ) THEN
    EXECUTE 'UPDATE email_messages SET is_sent = is_outbound WHERE is_sent = false AND is_outbound = true';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'email_messages'
      AND column_name = 'html_body'
  ) THEN
    EXECUTE 'UPDATE email_messages SET html_body_sanitized = COALESCE(html_body_sanitized, html_body) WHERE html_body_sanitized IS NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_messages_org_received_idx
  ON email_messages(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS email_messages_sender_idx
  ON email_messages(organization_id, from_email);
