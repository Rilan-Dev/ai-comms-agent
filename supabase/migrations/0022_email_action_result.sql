-- Repair the email action runtime schema for deployments that predate the result column.

ALTER TABLE email_actions
  ADD COLUMN IF NOT EXISTS result jsonb NOT NULL DEFAULT '{}'::jsonb;
