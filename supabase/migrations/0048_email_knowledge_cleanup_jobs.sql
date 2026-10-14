-- 0048 — Durable email-index cleanup requests for message and account removal.
-- account_id intentionally has no FK: cleanup must survive account deletion.
CREATE TABLE IF NOT EXISTS email_knowledge_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','zoho','imap_smtp')),
  scope text NOT NULL DEFAULT 'account' CHECK (scope IN ('message','account')),
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','retry','completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((scope='account' AND provider_message_id IS NULL) OR
         (scope='message' AND provider_message_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS email_knowledge_cleanup_account_unique_idx
  ON email_knowledge_cleanup_jobs (organization_id, account_id)
  WHERE scope='account';

CREATE UNIQUE INDEX IF NOT EXISTS email_knowledge_cleanup_message_unique_idx
  ON email_knowledge_cleanup_jobs (organization_id, account_id, provider_message_id)
  WHERE scope='message';

CREATE INDEX IF NOT EXISTS email_knowledge_cleanup_due_idx
  ON email_knowledge_cleanup_jobs (next_attempt_at, created_at)
  WHERE status IN ('pending','retry');

COMMENT ON TABLE email_knowledge_cleanup_jobs IS
  'Durable account- and message-scoped email vector cleanup requests. Complete only after Clara RAG/vector deletion is confirmed.';
