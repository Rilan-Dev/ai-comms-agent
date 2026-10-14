-- 0047 — Drop the legacy broken search_tsv column (no truncation, fails on
-- large Zoho/Gmail emails with "string is too long for tsvector").
--
-- Root cause: migration 0002_application_domain.sql created TWO mechanisms
-- for tsvector search on email_messages:
--   1. `search_tsv` GENERATED ALWAYS AS (to_tsvector('simple',
--      coalesce(subject,'') || ' ' || coalesce(text_body,''))) STORED
--      ← NO truncation, fails when text_body > 1MB
--   2. (later) `search_vector` GENERATED ALWAYS AS (... setweight(...
--      left(coalesce(text_body,''), 100000)) ...) STORED
--      ← migration 0045 added this WITH truncation
--
-- Both columns coexisted on the table. INSERT into email_messages evaluated
-- BOTH generated columns — `search_vector` succeeded (truncation worked),
-- but `search_tsv` failed (no truncation, text_body > 1MB) and aborted the
-- INSERT.
--
-- The app's runtime queries use `search_vector` (the one with weights A/B/C
-- and `left()` truncation). `search_tsv` is never queried by the app.
-- Drop the broken legacy column + its GIN index. Idempotent.

-- Drop the GIN index that depends on search_tsv (must drop before column).
DROP INDEX IF EXISTS aca.email_messages_search_tsv_gin;

-- Drop the legacy broken GENERATED column.
ALTER TABLE aca.email_messages
  DROP COLUMN IF EXISTS search_tsv;
