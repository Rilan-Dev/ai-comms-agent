-- FIX-01: repair existing WhatsApp checks installed by 0035 / 0036.
-- Forward-only upgrade: historical CREATE TABLE IF NOT EXISTS declarations do not
-- replace CHECK expressions on already-installed tables.
-- Apply through the operator's approved migration process (OPS-01 owns rollout).
-- PostgreSQL validates existing rows while adding each replacement constraint;
-- if any row fails, this migration fails atomically instead of weakening validation.

ALTER TABLE whatsapp_send_actions
  DROP CONSTRAINT whatsapp_send_actions_recipient_phone_check,
  ADD CONSTRAINT whatsapp_send_actions_recipient_phone_check
    CHECK (recipient_phone ~ '^[+][1-9][0-9]{7,14}$');

-- PostgreSQL repetition bounds are capped at 255; keep the 512-character
-- product limit in char_length() and use an unbounded character-class regex.
ALTER TABLE whatsapp_templates
  DROP CONSTRAINT whatsapp_templates_name_check,
  ADD CONSTRAINT whatsapp_templates_name_check
    CHECK (char_length(name) BETWEEN 1 AND 512 AND name ~ '^[a-z0-9_]+$');
