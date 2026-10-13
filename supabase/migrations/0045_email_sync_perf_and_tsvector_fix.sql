-- 0045 — Email sync performance + tsvector overflow fix
--
-- Two related fixes for the mailbox sync pipeline:
--
-- 1. tsvector overflow:
--    email_messages.search_vector is a GENERATED ALWAYS column computed
--    from coalesce(text_body,''). When a Zoho/Gmail email body exceeds
--    1 MB (e.g., HTML with embedded base64 images), PostgreSQL refuses
--    to compute the tsvector with error 54000 "string is too long for
--    tsvector (N bytes, max 1048575 bytes)". The full body still fits
--    in the text_body column (TOASTed), but the GENERATED column cannot
--    truncate. Replace the expression with left(coalesce(text_body,''), 100000)
--    so only the first 100 KB participates in the search index — full
--    text remains queryable via ILIKE on text_body.
--
-- 2. Decouple indexing from sync:
--    Add email_messages.indexed_at timestamptz column. The sync loop
--    writes email_messages rows with indexed_at=NULL; a separate
--    worker tick (processEmailKnowledgeIndexingBatch) selects rows
--    where indexed_at IS NULL, chunk+sinsert into knowledge_chunks,
--    and marks indexed_at=now(). This decouples the slow RAG indexing
--    from the fast Gmail API fetch + persist pipeline so a long
--    initial import no longer stalls on per-message chunking.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fix the search_vector GENERATED column expression.
-- ────────────────────────────────────────────────────────────────────────────

-- Drop the existing GENERATED column so we can re-add with a safer expression.
ALTER TABLE email_messages
  DROP COLUMN IF EXISTS search_vector;

ALTER TABLE email_messages
  ADD COLUMN search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(subject,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(from_name,'')), 'B') ||
    setweight(to_tsvector('simple', left(coalesce(text_body,''), 100000)), 'C')
  ) STORED;

-- Re-create the GIN index (drop IF EXISTS first — sometimes it cascades with
-- the column drop above, sometimes not depending on PG version).
CREATE INDEX IF NOT EXISTS email_messages_search_idx
  ON email_messages USING gin(search_vector);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Decoupled indexing queue.
--    NULL = needs indexing; non-NULL = already indexed (or re-index needed).
--    The indexer worker writes knowledge_chunks + knowledge_documents and
--    then UPDATE email_messages SET indexed_at=now().
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS indexed_at timestamptz;

-- Lightweight btree — the indexer tick's WHERE clause is exactly this filter.
CREATE INDEX IF NOT EXISTS email_messages_pending_index_idx
  ON email_messages (organization_id, email_account_id)
  WHERE indexed_at IS NULL;

-- Backfill existing rows as "already indexed" so the new indexer tick doesn't
-- try to re-chunk every historical message. The current sync's per-message
-- indexEmailKnowledge call already wrote their knowledge_documents; we mark
-- them done so only new messages (post-migration) flow through the queue.
UPDATE email_messages
  SET indexed_at = now()
  WHERE indexed_at IS NULL
    AND id IN (SELECT document_id FROM knowledge_chunks);
