-- Reconcile legacy audit columns with the current event contract.
--
-- Older deployed schemas created audit_events with resource_type and outcome
-- as NOT NULL columns. The current application writes target_type and decision
-- instead. Keep legacy columns/data for compatibility, but stop requiring the
-- retired fields for new writes. This is safe for both fresh and upgraded DBs.

DO $aca$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'audit_events'
      AND column_name = 'resource_type'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE audit_events ALTER COLUMN resource_type DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'audit_events'
      AND column_name = 'outcome'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE audit_events ALTER COLUMN outcome DROP NOT NULL;
  END IF;
END
$aca$;
