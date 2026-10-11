-- 0041 — Make whatsapp_accounts.waba_id nullable
-- The waba_id column was NOT NULL but some WhatsApp Business accounts
-- don't provide a WABA ID upfront (only phone_number_id + access_token).
-- Migration makes it nullable so accounts can be saved without it.
-- Idempotent. Forward-only.

ALTER TABLE whatsapp_accounts
  ALTER COLUMN waba_id DROP NOT NULL;
