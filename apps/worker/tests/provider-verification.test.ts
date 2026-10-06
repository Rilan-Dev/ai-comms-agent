import assert from "node:assert/strict";
import test from "node:test";
import type { CapabilitySet, EmailCredentials, EmailProvider } from "@ai-comms-agent/shared";
import { verifyEmailProviderConnection } from "../src/email/provider-verification";

const capabilities = Object.fromEntries([
  "folders","labels","sync_incremental","sync_full","sync_webhook","sync_idle",
  "search_server_side","search_client_side","drafts","reply","forward","mark_read",
  "archive","move","threads","attachments_download","attachments_upload","send",
].map((key) => [key, key === "folders" || key === "sync_full"])) as CapabilitySet;

function fakeProvider(options: { failConnect?: boolean; failDiscover?: boolean; failDisconnect?: boolean }): EmailProvider & { state: string } {
  const state = { value: "new" };
  return {
    providerId: "gmail",
    state: state.value,
    async connect(_credentials: EmailCredentials) { if (options.failConnect) throw new Error("connect failed"); state.value = "connected"; },
    async disconnect() { state.value = "disconnected"; if (options.failDisconnect) throw new Error("disconnect failed"); },
    async discoverCapabilities() { if (options.failDiscover) throw new Error("discovery failed"); return capabilities; },
    capabilities: () => capabilities,
    async listFolders() { return []; }, async listMessages() { return []; }, async getMessage() { return null; }, async getThread() { return []; }, async search() { return []; },
    async createDraft() { return { draft_id: "d", account_id: "a" }; }, async updateDraft() { return { draft_id: "d", account_id: "a" }; }, async deleteDraft() {},
    async sendDraft() { return { message_id: "m", provider_message_id: "pm" }; }, async send() { return { message_id: "m", provider_message_id: "pm" }; }, async reply() { return { message_id: "m", provider_message_id: "pm" }; }, async forward() { return { message_id: "m", provider_message_id: "pm" }; },
    async markRead() {}, async markUnread() {}, async archive() {}, async move() {}, async downloadAttachment() { return Buffer.alloc(0); },
  } as EmailProvider & { state: string };
}

test("provider verification connects, normalizes capabilities, and always disconnects", async () => {
  const provider = fakeProvider({});
  const result = await verifyEmailProviderConnection(provider, { credential_type: "oauth_token", access_token: "server-only" });
  assert.equal(result.capabilities.folders, true);
  assert.equal(result.capabilities.send, false);
  assert.equal((provider as typeof provider & { state: string }).state, "new");
});

test("provider verification disconnects when capability discovery fails", async () => {
  const provider = fakeProvider({ failDiscover: true });
  await assert.rejects(() => verifyEmailProviderConnection(provider, { credential_type: "oauth_token", access_token: "server-only" }), /discovery failed/);
  assert.equal((provider as typeof provider & { state: string }).state, "new");
});

test("provider verification does not call disconnect when connect fails", async () => {
  const provider = fakeProvider({ failConnect: true });
  await assert.rejects(() => verifyEmailProviderConnection(provider, { credential_type: "oauth_token", access_token: "server-only" }), /connect failed/);
});
