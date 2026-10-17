import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repository = readFileSync(
  resolve(here, "../../../packages/db/src/messaging/whatsapp-repository.ts"),
  "utf8",
);
const messagingMigration = readFileSync(
  resolve(here, "../../../supabase/migrations/0004_messaging.sql"),
  "utf8",
);

describe("WhatsApp outbound idempotency conflict target", () => {
  it("matches the partial unique index predicate declared by the schema", () => {
    expect(messagingMigration).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_idempotency_uniq\s+ON whatsapp_messages\(organization_id, idempotency_key\)\s+WHERE idempotency_key IS NOT NULL/i,
    );
    expect(repository).toMatch(
      /ON CONFLICT \(organization_id, idempotency_key\) WHERE idempotency_key IS NOT NULL DO NOTHING RETURNING id/i,
    );
  });

  it("keeps idempotency scoped to the organization and payload conflict handling", () => {
    expect(repository).toMatch(
      /SELECT whatsapp_account_id, contact_id, body FROM whatsapp_messages WHERE organization_id = \$1 AND idempotency_key = \$2 AND direction = 'outbound'/,
    );
    expect(repository).toContain("Idempotency key already exists for a different WhatsApp payload");
  });
});
