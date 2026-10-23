-- Reconcile the original 0002 tables with the current approval repository.
-- CREATE TABLE IF NOT EXISTS in 0007 did not upgrade existing tables. Keep
-- legacy columns and history; never reset actions or infer send consent.
ALTER TABLE email_actions
  ADD COLUMN IF NOT EXISTS email_account_id uuid REFERENCES email_accounts(id),
  ADD COLUMN IF NOT EXISTS draft_id uuid REFERENCES email_messages(id),
  ADD COLUMN IF NOT EXISTS recipient_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Manual Compose actions are authenticated-user actions, with no agent.
ALTER TABLE email_actions ALTER COLUMN agent_id DROP NOT NULL;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='email_actions' AND column_name='target') THEN
    ALTER TABLE email_actions ALTER COLUMN target SET DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Either historical enum can be the actual status column type. Add values
-- only; they are first used by subsequent committed application requests.
DO $$ DECLARE status_type regtype; BEGIN
  SELECT atttypid::regtype INTO status_type FROM pg_attribute
    WHERE attrelid='email_actions'::regclass AND attname='status' AND NOT attisdropped;
  IF EXISTS (SELECT 1 FROM pg_type WHERE oid=status_type AND typtype='e') THEN
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L',status_type,'executing');
    EXECUTE format('ALTER TYPE %s ADD VALUE IF NOT EXISTS %L',status_type,'cancelled');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS email_actions_org_idempotency_uniq
  ON email_actions(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE email_action_approvals
  ADD COLUMN IF NOT EXISTS email_action_id uuid REFERENCES email_actions(id),
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id),
  ADD COLUMN IF NOT EXISTS decided_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  -- Only a legacy row awaiting linkage needs its old timestamp backfilled.
  -- Canonical rows must retain their existing audit timestamp on rerun.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='email_action_approvals' AND column_name='decided_at') THEN
    UPDATE email_action_approvals SET created_at=decided_at
      WHERE decided_at IS NOT NULL AND email_action_id IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='email_action_approvals' AND column_name='action_id') THEN
    UPDATE email_action_approvals SET email_action_id=action_id WHERE email_action_id IS NULL;
    ALTER TABLE email_action_approvals ALTER COLUMN action_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='email_action_approvals' AND column_name='approver_id') THEN
    UPDATE email_action_approvals SET decided_by=approver_id WHERE decided_by IS NULL;
    ALTER TABLE email_action_approvals ALTER COLUMN approver_id DROP NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema()
    AND table_name='email_action_approvals' AND column_name='reason') THEN
    UPDATE email_action_approvals SET comment=reason WHERE comment IS NULL;
  END IF;
END $$;
UPDATE email_action_approvals p SET organization_id=a.organization_id
  FROM email_actions a WHERE p.email_action_id=a.id AND p.organization_id IS NULL;
ALTER TABLE email_action_approvals
  ALTER COLUMN email_action_id SET NOT NULL,
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN decided_by SET NOT NULL;
CREATE INDEX IF NOT EXISTS email_action_approvals_org_idx
  ON email_action_approvals(organization_id,created_at DESC);
