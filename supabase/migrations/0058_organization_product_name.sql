-- Workspace display branding. Organizations may set an optional product /
-- workspace display name. The web shell resolves the displayed name as
-- product_name (when present) -> organization name -> "Workspace", so the
-- navigation bar and browser tab never fall back to a hard-coded product
-- brand. NULL/empty keeps the organization name as the display name.
BEGIN;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS product_name text;

COMMENT ON COLUMN organizations.product_name IS
  'Optional workspace display name (navbar and browser tab). Falls back to the organization name when NULL or empty.';
COMMIT;
