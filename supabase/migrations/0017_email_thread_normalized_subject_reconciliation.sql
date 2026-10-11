-- Reconcile existing email_threads tables with the current email repository contract.
-- Older deployments may have created the table before normalized_subject was added.
-- Preserve existing mail/thread records and derive normalized values from stored subjects.

ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS normalized_subject text;

UPDATE email_threads
SET normalized_subject = lower(
  regexp_replace(
    coalesce(subject, ''),
    '^([[:space:]]*(re|fwd):[[:space:]]*)+',
    '',
    'gi'
  )
)
WHERE normalized_subject IS NULL;

