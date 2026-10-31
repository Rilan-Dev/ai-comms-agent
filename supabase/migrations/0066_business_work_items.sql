CREATE TABLE IF NOT EXISTS business_work_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 automation_run_id uuid REFERENCES automation_runs(id) ON DELETE SET NULL,
 agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK (kind IN ('opportunity','service_ticket')),
 source_event_type text NOT NULL CHECK (source_event_type IN ('email.received','email.action_required','whatsapp.received')),
 source_event_key text NOT NULL CHECK (length(source_event_key) BETWEEN 1 AND 180),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 250),
 description text NOT NULL DEFAULT '',
 ai_summary text NOT NULL DEFAULT '',
 source_contact text,
 priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','high','urgent')),
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','completed')),
 review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
 assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,kind,source_event_type,source_event_key)
);
CREATE INDEX IF NOT EXISTS business_work_items_org_queue_idx
 ON business_work_items(organization_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS business_work_items_assignee_idx
 ON business_work_items(assigned_user_id,created_at DESC);
ALTER TABLE business_work_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_work_items_member_read ON business_work_items;
CREATE POLICY business_work_items_member_read ON business_work_items FOR SELECT
 USING (aca.app_is_org_member(organization_id));
-- No direct interactive INSERT/UPDATE/DELETE policy. Authenticated routes
-- validate roles/tenancy; system worker writes via its privileged connection.
