\set ON_ERROR_STOP on
-- Issue #47: post-proposal, read-only pending-row check.
-- Invoke without an action ID after running the authenticated browser harness:
--   psql -X -v ON_ERROR_STOP=1 -d postgres -f scripts/tests/whatsapp-issue47-pending.postgres.sql
-- Alternatively select a particular action with: -v action_id=UUID
-- Never print the recipient, message body or private organization IDs.
-- ID-free mode REQUIRES exactly one uniquely matching recent test action.
-- A missing, stale or ambiguous test is a hard failure; no writes or sends occur.

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
\if :{?action_id}
WHERE id = :'action_id'::uuid
\else
WHERE message_body = 'Issue 47 pending approval acceptance test. DO NOT APPROVE OR SEND.'
  AND created_at >= now() - interval '30 minutes'
\endif
\gset

\if :acceptance_pending_only
\echo 'PASS: exactly one unexpired pending-only action, no queue linkage and no approval'
\else
\echo 'FAIL: no unique recent test action, or action expired, approved, queued or malformed; run browser test first. If repeated, use -v action_id=UUID locally.'
SELECT 1 / 0;
\endif
ROLLBACK;
