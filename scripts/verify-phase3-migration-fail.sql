-- Expected-failure verification: direct organization creation without an owner
-- must be rejected at transaction commit by the deferred organization trigger.
\set ON_ERROR_STOP on
INSERT INTO organizations (id, name, slug)
VALUES ('10000000-0000-0000-0000-000000000099', 'Ownerless Org', 'ownerless-org');
