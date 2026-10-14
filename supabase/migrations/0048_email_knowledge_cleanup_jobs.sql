-- 0048 — Durable email-index cleanup requests for connected-account removal.
-- account_id intentionally has no FK: the account is deleted while cleanup may
-- remain pending until the configured Clara RAG/vector adapter confirms purge.
CREATE TABLE IF NOT EXISTS email_knowledge_cleanup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('gmail','zoho','imap_smtp')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','retry','completed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, account_id)
);

CREATE INDEX IF NOT EXISTS email_knowledge_cleanup_due_idx
  ON email_knowledge_cleanup_jobs (next_attempt_at, created_at)
  WHERE status IN ('pending','retry');

COMMENT ON TABLE email_knowledge_cleanup_jobs IS
  'Durable account-scoped email vector cleanup requests. Complete only after Clara RAG/vector deletion is confirmed.';
