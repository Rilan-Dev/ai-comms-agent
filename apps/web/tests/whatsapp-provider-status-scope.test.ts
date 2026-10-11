import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/messaging/whatsapp-repository.ts"), "utf8");
const webhook = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/webhook/route.ts"), "utf8");

describe("WhatsApp provider status isolation", () => {
  it("requires organization and account scope when applying provider status", () => {
    expect(repository).toContain("organizationId: string; accountId: string; providerMessageId");
    expect(repository).toContain("WHERE provider_message_id = $3 AND organization_id = $4 AND whatsapp_account_id = $6");
  });

  it("passes the resolved webhook account scope into status updates", () => {
    expect(webhook).toContain("organizationId: account.organization_id");
    expect(webhook).toContain("accountId: account.id");
    expect(webhook).toContain("applyWhatsAppProviderStatus({");
  });
});
