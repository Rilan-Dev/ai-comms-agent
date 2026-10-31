-- Canonical tenant/started-at fields for durable event automation runs.
-- Legacy worker inserted neither field; recover historical rows from the
-- immutable parent rule and original trigger timestamp, without replaying.
UPDATE automation_runs r
SET organization_id = a.organization_id
FROM automation_rules a
WHERE r.automation_rule_id = a.id
  AND r.organization_id IS DISTINCT FROM a.organization_id;

UPDATE automation_runs
SET started_at = COALESCE(started_at,triggered_at,created_at)
WHERE started_at IS NULL;

-- Future writes must carry both fields. Deploy the tenant-scoped writer first.
ALTER TABLE automation_runs ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE automation_runs ALTER COLUMN started_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS automation_runs_stale_processing_idx
ON automation_runs (started_at,id)
WHERE status='running';
