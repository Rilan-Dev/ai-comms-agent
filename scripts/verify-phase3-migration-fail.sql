-- Expected failure: an organization cannot commit without an active owner.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO organizations (id, name, slug)
VALUES ('10000000-0000-0000-0000-000000000099', 'Ownerless Org', 'ownerless-org');
COMMIT;
