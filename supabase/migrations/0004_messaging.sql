-- Phase 4: WhatsApp/messaging persistence.
DO $$ BEGIN
  CREATE TYPE whatsapp_account_status AS ENUM ('pending','connected','error','disconnected','revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE whatsapp_message_direction AS ENUM ('inbound','outbound');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE whatsapp_message_status AS ENUM ('received','queued','sent','delivered','read','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'meta_cloud',
  business_account_id text,
  phone_number_id text NOT NULL,
  phone_number citext,
  display_name text,
  status whatsapp_account_status NOT NULL DEFAULT 'pending',
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  credential_ciphertext bytea,
  credential_key_reference text,
  connected_at timestamptz,
  last_error text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE whatsapp_accounts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_org_phone_uniq
ON whatsapp_accounts(organization_id, phone_number_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS whatsapp_accounts_org_status_idx ON whatsapp_accounts(organization_id,status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'aca.agent_whatsapp_accounts'::regclass
      AND conname = 'agent_whatsapp_accounts_account_fk'
  ) THEN
    ALTER TABLE agent_whatsapp_accounts
      ADD CONSTRAINT agent_whatsapp_accounts_account_fk
      FOREIGN KEY (whatsapp_account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('whatsapp_contacts') IS NOT NULL THEN
    ALTER TABLE whatsapp_contacts
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  provider_contact_id text,
  phone_number citext NOT NULL,
  display_name text,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  opted_in boolean,
  last_interaction_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(whatsapp_account_id, phone_number)
);
CREATE INDEX IF NOT EXISTS whatsapp_contacts_org_idx ON whatsapp_contacts(organization_id);

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES whatsapp_contacts(id) ON DELETE SET NULL,
  direction whatsapp_message_direction NOT NULL,
  provider_message_id text,
  message_type text NOT NULL DEFAULT 'text',
  body text,
  media jsonb NOT NULL DEFAULT '{}'::jsonb,
  status whatsapp_message_status NOT NULL DEFAULT 'received',
  reply_to_message_id uuid REFERENCES whatsapp_messages(id) ON DELETE SET NULL,
  idempotency_key text,
  provider_timestamp timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE whatsapp_messages
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_uniq
ON whatsapp_messages(whatsapp_account_id, provider_message_id)
WHERE provider_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_idempotency_uniq
ON whatsapp_messages(organization_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_messages_org_created_idx
ON whatsapp_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_contact_idx
ON whatsapp_messages(contact_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  whatsapp_account_id uuid REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
  provider_event_id text,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'received',
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  error text
);
ALTER TABLE whatsapp_webhook_events
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_webhook_provider_event_uniq
ON whatsapp_webhook_events(whatsapp_account_id, provider_event_id)
WHERE provider_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_webhook_org_received_idx
ON whatsapp_webhook_events(organization_id, received_at DESC);

CREATE OR REPLACE FUNCTION update_whatsapp_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
CREATE TRIGGER whatsapp_accounts_updated_at BEFORE UPDATE ON whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE TRIGGER whatsapp_contacts_updated_at BEFORE UPDATE ON whatsapp_contacts FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
CREATE TRIGGER whatsapp_messages_updated_at BEFORE UPDATE ON whatsapp_messages FOR EACH ROW EXECUTE FUNCTION update_whatsapp_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_accounts' AND policyname = 'whatsapp_accounts_member_visibility') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_accounts_member_visibility ON whatsapp_accounts FOR SELECT TO authenticated
      USING (can_access_organization(organization_id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_accounts' AND policyname = 'whatsapp_accounts_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_accounts_admin_manage ON whatsapp_accounts FOR ALL TO authenticated
      USING (can_manage_organization(organization_id))
      WITH CHECK (can_manage_organization(organization_id));$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_contacts' AND policyname = 'whatsapp_contacts_member_visibility') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_contacts_member_visibility ON whatsapp_contacts FOR SELECT TO authenticated
      USING (can_access_organization(organization_id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_contacts' AND policyname = 'whatsapp_contacts_member_manage') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_contacts_member_manage ON whatsapp_contacts FOR ALL TO authenticated
      USING (can_access_organization(organization_id))
      WITH CHECK (can_access_organization(organization_id));$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_messages' AND policyname = 'whatsapp_messages_member_visibility') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_messages_member_visibility ON whatsapp_messages FOR SELECT TO authenticated
      USING (can_access_organization(organization_id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_messages' AND policyname = 'whatsapp_messages_member_manage') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_messages_member_manage ON whatsapp_messages FOR ALL TO authenticated
      USING (can_access_organization(organization_id))
      WITH CHECK (can_access_organization(organization_id));$policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_webhook_events' AND policyname = 'whatsapp_webhook_admin_visibility') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_webhook_admin_visibility ON whatsapp_webhook_events FOR SELECT TO authenticated
      USING (can_manage_organization(organization_id));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = current_schema() AND tablename = 'whatsapp_webhook_events' AND policyname = 'whatsapp_webhook_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY whatsapp_webhook_admin_manage ON whatsapp_webhook_events FOR ALL TO authenticated
      USING (can_manage_organization(organization_id))
      WITH CHECK (can_manage_organization(organization_id));$policy$;
  END IF;
END $$;