-- Phase 4: normalize provider binding foreign keys and cross-tenant integrity.

ALTER TABLE agent_email_accounts
  DROP CONSTRAINT IF EXISTS agent_email_accounts_email_account_fk;
ALTER TABLE agent_email_accounts
  ADD CONSTRAINT agent_email_accounts_email_account_fk
  FOREIGN KEY (email_account_id) REFERENCES email_accounts(id) ON DELETE CASCADE;

ALTER TABLE agent_whatsapp_accounts
  DROP CONSTRAINT IF EXISTS agent_whatsapp_accounts_account_fk;
ALTER TABLE agent_whatsapp_accounts
  ADD CONSTRAINT agent_whatsapp_accounts_account_fk
  FOREIGN KEY (whatsapp_account_id) REFERENCES whatsapp_accounts(id) ON DELETE CASCADE;

-- Keep tenant identity aligned across parent/child bindings at the database
-- boundary. These checks prevent accidentally attaching another organization's
-- account to an agent even when application code is bypassed.
CREATE OR REPLACE FUNCTION enforce_agent_email_account_org()
RETURNS TRIGGER AS $$
DECLARE account_org uuid;
BEGIN
  IF NEW.email_account_id IS NULL THEN RETURN NEW; END IF;
  SELECT organization_id INTO account_org FROM email_accounts WHERE id = NEW.email_account_id;
  IF account_org IS NULL OR account_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'Email account does not belong to agent organization' USING ERRCODE='foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION enforce_agent_whatsapp_account_org()
RETURNS TRIGGER AS $$
DECLARE account_org uuid;
BEGIN
  IF NEW.whatsapp_account_id IS NULL THEN RETURN NEW; END IF;
  SELECT organization_id INTO account_org FROM whatsapp_accounts WHERE id = NEW.whatsapp_account_id;
  IF account_org IS NULL OR account_org <> NEW.organization_id THEN
    RAISE EXCEPTION 'WhatsApp account does not belong to agent organization' USING ERRCODE='foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_email_account_org_guard ON agent_email_accounts;
CREATE TRIGGER agent_email_account_org_guard BEFORE INSERT OR UPDATE ON agent_email_accounts
FOR EACH ROW EXECUTE FUNCTION enforce_agent_email_account_org();

DROP TRIGGER IF EXISTS agent_whatsapp_account_org_guard ON agent_whatsapp_accounts;
CREATE TRIGGER agent_whatsapp_account_org_guard BEFORE INSERT OR UPDATE ON agent_whatsapp_accounts
FOR EACH ROW EXECUTE FUNCTION enforce_agent_whatsapp_account_org();

CREATE UNIQUE INDEX IF NOT EXISTS agent_whatsapp_accounts_one_per_agent
ON agent_whatsapp_accounts(agent_id);
