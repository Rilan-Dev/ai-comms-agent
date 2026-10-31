CREATE TABLE IF NOT EXISTS automation_event_outbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 event_type text NOT NULL CHECK(event_type IN ('email.received','email.action_required')),
 source_key text NOT NULL CHECK(length(source_key) BETWEEN 1 AND 180),
 payload jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','completed','failed')),
 attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 claimed_at timestamptz,completed_at timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,event_type,source_key)
);
CREATE INDEX IF NOT EXISTS automation_event_outbox_due_idx ON automation_event_outbox(next_attempt_at,created_at) WHERE status IN ('queued','processing');
CREATE INDEX IF NOT EXISTS email_messages_automation_event_scan ON email_messages(created_at,id) WHERE is_draft=false AND is_sent=false;
ALTER TABLE automation_event_outbox ENABLE ROW LEVEL SECURITY;
-- Worker-owned queue: no direct interactive-application RLS grant.
