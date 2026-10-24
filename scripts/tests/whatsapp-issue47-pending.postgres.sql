\set ON_ERROR_STOP on
-- Issue #47: post-proposal, read-only pending-row check.
-- Invoke with: psql -X -v ON_ERROR_STOP=1 -v action_id=UUID -d postgres -f scripts/tests/whatsapp-issue47-pending.postgres.sql
-- Never print the recipient, message body or private organization IDs.
\if :{?action_id}
\else
\echo 'ERROR: provide -v action_id=UUID from the browser smoke acceptance output'
SELECT 1 / 0;
\endif

BEGIN READ ONLY;
SELECT (
  count(*) = 1
  AND coalesce(bool_and(
    status = 'pending'
    AND queued_message_id IS NULL
    AND approved_at IS NULL
    AND expires_at > now()
    AND requested_by IS NOT NULL
    AND payload_type = 'text'
  ), false)
) AS acceptance_pending_only
FROM aca.whatsapp_send_actions
WHERE id = :'action_id'::uuid
\gset

\if :acceptance_pending_only
\echo 'PASS: exactly one unexpired pending-only action, no queue linkage and no approval'
\else
\echo 'FAIL: action missing, expired, approved, queued or malformed; no live acceptance'
SELECT 1 / 0;
\endif
ROLLBACK;
