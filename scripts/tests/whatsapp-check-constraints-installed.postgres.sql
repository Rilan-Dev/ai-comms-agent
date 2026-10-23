\set ON_ERROR_STOP on
-- OPS-01 post-deploy verification; read-only and safe for an authorized DB.
-- Requires the approved 0053 migration to have been applied to schema aca.
-- This is a source/constraint verification, NOT a WhatsApp send or Meta check.
-- A matching NOT VALID constraint is insufficient: pre-existing rows must be validated.
BEGIN READ ONLY;
SET LOCAL standard_conforming_strings = on;

DO $$
DECLARE
  phone_definition text;
  phone_validated boolean;
  template_definition text;
  template_validated boolean;
BEGIN
  SELECT pg_get_constraintdef(c.oid), c.convalidated
    INTO phone_definition, phone_validated
    FROM pg_constraint AS c
   WHERE c.conrelid = to_regclass('aca.whatsapp_send_actions')
     AND c.conname = 'whatsapp_send_actions_recipient_phone_check'
     AND c.contype = 'c';
  IF phone_definition IS NULL
     OR phone_validated IS DISTINCT FROM TRUE
     OR position('^[+][1-9][0-9]{7,14}$' IN phone_definition) = 0
  THEN
    RAISE EXCEPTION 'WhatsApp phone CHECK 0053 has not been installed correctly';
  END IF;

  SELECT pg_get_constraintdef(c.oid), c.convalidated
    INTO template_definition, template_validated
    FROM pg_constraint AS c
   WHERE c.conrelid = to_regclass('aca.whatsapp_templates')
     AND c.conname = 'whatsapp_templates_name_check'
     AND c.contype = 'c';
  IF template_definition IS NULL
     OR template_validated IS DISTINCT FROM TRUE
     OR position('char_length' IN template_definition) = 0
     OR position('512' IN template_definition) = 0
     OR position('^[a-z0-9_]+$' IN template_definition) = 0
  THEN
    RAISE EXCEPTION 'WhatsApp template CHECK 0053 has not been installed correctly';
  END IF;
END $$;

ROLLBACK;
