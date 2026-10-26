-- 0048 — Durable email-to-vector sync outbox for message/account lifecycle changes.
-- account_id intentionally has no FK: cleanup jobs must survive account deletion.
CREATE TABLE IF NOT EXISTS email_knowledge_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','zoho','imap_smtp')),
  operation text NOT NULL CHECK (operation IN ('upsert_message','delete_message','delete_account')),
  provider_message_id text,
  source_identity_hash text,
  content_hash text,
  metadata_hash text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','retry','completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((operation='delete_account' AND provider_message_id IS NULL) OR
         (operation IN ('upsert_message','delete_message') AND provider_message_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS email_knowledge_upsert_unique_idx
  ON email_knowledge_sync_jobs (organization_id, account_id, provider_message_id)
  WHERE operation='upsert_message';

CREATE UNIQUE INDEX IF NOT EXISTS email_knowledge_delete_message_unique_idx
  ON email_knowledge_sync_jobs (organization_id, account_id, provider_message_id)
  WHERE operation='delete_message';

CREATE UNIQUE INDEX IF NOT EXISTS email_knowledge_delete_account_unique_idx
  ON email_knowledge_sync_jobs (organization_id, account_id)
  WHERE operation='delete_account';

CREATE INDEX IF NOT EXISTS email_knowledge_sync_due_idx
  ON email_knowledge_sync_jobs (next_attempt_at, created_at)
  WHERE status IN ('pending','retry');

COMMENT ON TABLE email_knowledge_sync_jobs IS
  'Durable email vector upsert, message deletion, and account purge outbox. Complete only after agent RAG/vector operations are confirmed.';
