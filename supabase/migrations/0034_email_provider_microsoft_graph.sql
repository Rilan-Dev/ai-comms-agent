-- The mailbox worker and Microsoft Graph lifecycle code use email_provider,
-- which was created before Microsoft Graph support was added to the application.
-- email_account_provider is a separate enum and does not satisfy email_accounts.provider.
ALTER TYPE email_provider ADD VALUE IF NOT EXISTS 'microsoft_graph';
