\set ON_ERROR_STOP on
-- OPS-01 post-deploy verification; read-only and safe for an authorized DB.
-- Requires the approved 0053 migration to have been applied to schema aca.
-- This is a source/constraint verification, NOT a WhatsApp send or Meta check.
BEGIN READ ONLY;
SET LOCAL standard_conforming_strings = on;

DO $$
DECLARE
  phone_definition text;
  template_definition text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO phone_definition
    FROM pg_constraint AS c
   WHERE c.conrelid = to_regclass('aca.whatsapp_send_actions')
     AND c.conname = 'whatsapp_send_actions_recipient_phone_check'
     AND c.contype = 'c';
  IF phone_definition IS NULL
     OR position('^[+][1-9][0-9]{7,14}$' IN phone_definition) = 0
  THEN
    RAISE EXCEPTION 'WhatsApp phone CHECK 0053 has not been installed correctly';
  END IF;

  SELECT pg_get_constraintdef(c.oid)
    INTO template_definition
    FROM pg_constraint AS c
   WHERE c.conrelid = to_regclass('aca.whatsapp_templates')
     AND c.conname = 'whatsapp_templates_name_check'
     AND c.contype = 'c';
  IF template_definition IS NULL
     OR position('char_length' IN template_definition) = 0
     OR position('512' IN template_definition) = 0
     OR position('^[a-z0-9_]+$' IN template_definition) = 0
  THEN
    RAISE EXCEPTION 'WhatsApp template CHECK 0053 has not been installed correctly';
  END IF;
END $$;

ROLLBACK;
