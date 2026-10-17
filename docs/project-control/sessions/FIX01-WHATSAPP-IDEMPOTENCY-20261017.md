# FIX-01 — WhatsApp outbound SQLSTATE 42P10 (2026-10-17)

## Symptom
The deployed POST /api/whatsapp/messages returned {"error":"internal_server_error"}. The user's web-container logs show PostgreSQL SQLSTATE 42P10, "there is no unique or exclusion constraint matching the ON CONFLICT specification", on the outbound insert into whatsapp_messages.

## Root cause
Source migration supabase/migrations/0004_messaging.sql defines whatsapp_messages_idempotency_uniq as a partial unique index on (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL. The outbound repository insert used ON CONFLICT (organization_id, idempotency_key) DO NOTHING without the matching predicate. PostgreSQL cannot infer a partial unique index for that conflict target, producing 42P10.

## Failed approaches / non-remedies
- Container status "Up" and worker health checks do not validate the web database's schema or the insert path.
- Restarting the worker alone cannot repair a SQL conflict-target mismatch in the web API.
- Removing idempotency or authorization guards would weaken correctness and security and is not acceptable.
- The source correction still depends on the production database having the declared unique index; if that index/migration is absent, OPS-01 must resolve the schema drift separately.

## Remedy committed
- Updated packages/db/src/messaging/whatsapp-repository.ts to use ON CONFLICT (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id.
- Added apps/web/tests/whatsapp-idempotency-conflict-target.test.ts to assert the query predicate matches the migration's partial unique index and to retain organization-scoped duplicate-payload handling.
- Source commit: ea8c19cfd9e235319323ed1bb7345e0395f5534e.
- Regression source commit: 4243afe7748d43ae371c06315f85d47f249cc814.
- OPS-01 follow-up: https://github.com/Rilan-Dev/ai-comms-agent/issues/33.

## Prevention
Keep conflict-target predicates aligned with partial unique index predicates. For any production schema error, inspect both the SQL statement and the exact deployed index/schema state. Preserve tenant scoping and deterministic idempotency semantics.

## Verification
GitHub source writes succeeded. The new regression test, typecheck, database migration/index state, Docker rebuild, production API, worker processing, Meta delivery and duplicate-key replay have NOT been run or verified here. No test or live-send PASS is claimed.

## Next action
OPS-01 confirms whatsapp_messages_idempotency_uniq exists on the exact production database used by web, deploys/recreates the web image from main at or beyond the source and test commits, then verifies a fresh outbound message, same-key/same-payload deduplication, same-key/different-payload conflict, worker processing and provider outcome. Do not paste cookies or access tokens into issues/logs.
