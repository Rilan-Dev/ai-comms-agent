-- Phase 4 WhatsApp schema reconciliation.
-- 0002_application_domain created an earlier WhatsApp shape. 0004_messaging
-- intentionally used CREATE IF NOT EXISTS, so this forward-only migration
-- fills the missing columns and normalizes status fields before runtime code
-- relies on the richer contract.

ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS business_account_id text,
  ADD COLUMN IF NOT EXISTS capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS credential_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS credential_key_reference text,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE whatsapp_accounts
  ALTER COLUMN status TYPE text USING status::text;

UPDATE whatsapp_accounts
SET status = CASE status
  WHEN 'active' THEN 'connected'
  WHEN 'pending_verification' THEN 'pending'
  ELSE 'revoked'
END;

ALTER TABLE whatsapp_accounts
  DROP CONSTRAINT IF EXISTS whatsapp_accounts_status_check;

ALTER TABLE whatsapp_accounts
  ADD CONSTRAINT whatsapp_accounts_status_check
  CHECK (status IN ('pending','connected','error','disconnected','revoked'));

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS provider_contact_id text,
  ADD COLUMN IF NOT EXISTS opted_in boolean,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE whatsapp_contacts c
SET organization_id = a.organization_id,
    last_interaction_at = COALESCE(c.last_message_at, c.first_seen_at)
FROM whatsapp_accounts a
WHERE a.id = c.whatsapp_account_id
  AND c.organization_id IS NULL;

ALTER TABLE whatsapp_contacts
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS provider_timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE whatsapp_messages m
SET organization_id = a.organization_id
FROM whatsapp_accounts a
WHERE a.id = m.whatsapp_account_id
  AND m.organization_id IS NULL;

ALTER TABLE whatsapp_messages
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN status TYPE text USING status::text;

ALTER TABLE whatsapp_messages
  DROP CONSTRAINT IF EXISTS whatsapp_messages_status_check;

ALTER TABLE whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_status_check
  CHECK (status IN ('received','queued','sent','delivered','read','failed'));

ALTER TABLE whatsapp_webhook_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payload_hash text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error text;

UPDATE whatsapp_webhook_events e
SET organization_id = a.organization_id,
    payload_hash = COALESCE(e.payload_hash, md5(e.payload::text))
FROM whatsapp_accounts a
WHERE a.id = e.whatsapp_account_id
  AND e.organization_id IS NULL;

ALTER TABLE whatsapp_webhook_events
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN payload_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_idempotency_uniq
  ON whatsapp_messages(organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_org_created_idx
  ON whatsapp_messages(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS whatsapp_contacts_org_idx
  ON whatsapp_contacts(organization_id);

CREATE INDEX IF NOT EXISTS whatsapp_webhook_org_received_idx
  ON whatsapp_webhook_events(organization_id, received_at DESC);

ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;
