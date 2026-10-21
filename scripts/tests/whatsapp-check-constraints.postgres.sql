\set ON_ERROR_STOP on
-- Run only against an isolated disposable PostgreSQL database.
-- Uses temporary tables and ROLLBACK; never applies a live migration.
BEGIN;
SET LOCAL standard_conforming_strings = on;
SET LOCAL search_path = pg_temp;

CREATE TEMP TABLE whatsapp_send_actions (
  recipient_phone text NOT NULL CONSTRAINT whatsapp_send_actions_recipient_phone_check
    CHECK (recipient_phone ~ '^\\+[1-9][0-9]{7,14}$')
);
CREATE TEMP TABLE whatsapp_templates (
  name text NOT NULL CONSTRAINT whatsapp_templates_name_check
    CHECK (name ~ '^[a-z0-9_]{1,512}$')
);

\ir ../../supabase/migrations/0053_whatsapp_check_constraints.sql

INSERT INTO whatsapp_send_actions(recipient_phone)
  VALUES ('+12345678'), ('+919876543210'), ('+123456789012345');
INSERT INTO whatsapp_templates(name)
  VALUES ('a'), ('order_update_2'), (repeat('a', 512));

DO $$
DECLARE value text;
BEGIN
  FOREACH value IN ARRAY ARRAY[
    '12345678', '919876543210', '+012345678', '+1234567',
    '+1234567890123456', '+123-456-789', '+ 12345678', ''
  ] LOOP
    BEGIN
      INSERT INTO whatsapp_send_actions(recipient_phone) VALUES (value);
      RAISE EXCEPTION 'invalid E164 number was accepted';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;
  END LOOP;

  FOREACH value IN ARRAY ARRAY[
    '', 'MixedCase', 'with-hyphen', 'with space', 'ä', repeat('a', 513)
  ] LOOP
    BEGIN
      INSERT INTO whatsapp_templates(name) VALUES (value);
      RAISE EXCEPTION 'invalid WhatsApp template name was accepted';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  BEGIN
    UPDATE whatsapp_send_actions SET recipient_phone='invalid';
    RAISE EXCEPTION 'invalid phone UPDATE was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
  BEGIN
    UPDATE whatsapp_templates SET name='BadName';
    RAISE EXCEPTION 'invalid template UPDATE was accepted';
  EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
  END;
END $$;
ROLLBACK;
