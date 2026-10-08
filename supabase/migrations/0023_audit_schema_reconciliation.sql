-- Runtime schema reconciliation for the append-only audit contract.
-- Older deployed databases can already contain audit_events from the initial
-- application migration. CREATE TABLE IF NOT EXISTS does not add columns to
-- those existing tables, so add the current repository contract forward-only.

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES agents(id) ON DELETE SET NULL;

ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS decision text;

CREATE INDEX IF NOT EXISTS audit_events_agent_created_idx
  ON audit_events(agent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_events_org_decision_idx
  ON audit_events(organization_id, decision, created_at DESC);
