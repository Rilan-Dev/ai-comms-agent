import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/accounts/route.ts"), "utf8");
const worker = readFileSync(resolve(__dirname, "../../worker/src/messaging/whatsapp-worker.ts"), "utf8");

describe("WhatsApp account display-name persistence", () => {
  it("keeps the user-selected display name when Meta verification returns its verified name", () => {
    expect(route).toContain("account.display_name ?? (typeof payload.verified_name === \"string\" ? payload.verified_name : null)");
    expect(route).toContain("display_name: account.display_name ?? (typeof payload.verified_name === \"string\" ? payload.verified_name : null)");
    expect(route).toContain("The user-editable display name is the app's label.");
    expect(worker).toContain('account.display_name ?? (typeof payload?.verified_name === "string" ? payload.verified_name : null)');
  });
});
