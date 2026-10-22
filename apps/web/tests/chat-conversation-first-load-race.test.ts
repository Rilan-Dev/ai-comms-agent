import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const repository = readFileSync(
  new URL("../../../packages/db/src/conversation/repository.ts", import.meta.url), "utf8",
);
const method = (start: string, end: string) => {
  const begin = repository.indexOf(start);
  const finish = repository.indexOf(end, begin);
  expect(begin).toBeGreaterThanOrEqual(0);
  expect(finish).toBeGreaterThan(begin);
  return repository.slice(begin, finish);
};

describe("chat conversation first-load concurrency", () => {
  it("locks the scoped agent before SELECT so two simultaneous first loads cannot each create a session", () => {
    const open = method("export async function getOrCreateChatConversation(", "/** A new session");
    const lock = open.indexOf("SELECT id FROM agents WHERE organization_id=$1 AND id=$2 FOR UPDATE");
    const lookup = open.indexOf("SELECT * FROM conversations WHERE organization_id=$1 AND agent_id=$2");
    const insert = open.indexOf("INSERT INTO conversations (organization_id, agent_id, channel, subject)");
    expect(open).toContain("return withTransaction(async (client) => {");
    expect(lock).toBeGreaterThanOrEqual(0);
    expect(lock).toBeLessThan(lookup);
    expect(lookup).toBeLessThan(insert);
    expect(open).toContain("if (!lockedAgent.rows[0]) throw new Error");
  });

  it("explicit New Chat uses the same agent row lock and never overwrites existing conversations", () => {
    const fresh = method("export async function createChatConversation(", "/** History entries");
    expect(fresh).toContain("return withTransaction(async (client) => {");
    expect(fresh).toContain("SELECT id FROM agents WHERE organization_id=$1 AND id=$2 FOR UPDATE");
    expect(fresh).toContain("INSERT INTO conversations (organization_id, agent_id, channel, subject)");
    expect(fresh).toContain("'chat','New chat'");
    expect(fresh).not.toMatch(/DELETE FROM conversations|DELETE FROM conversation_messages|UPDATE conversations SET status/);
  });

  it("only contends within the same organization+agent and avoids cross-tenant/global serialization", () => {
    const open = method("export async function getOrCreateChatConversation(", "/** A new session");
    const fresh = method("export async function createChatConversation(", "/** History entries");
    for (const sql of [open, fresh]) {
      expect(sql).toContain("organization_id=$1 AND id=$2 FOR UPDATE");
      expect(sql).toContain("[organizationId, agentId]");
      expect(sql).not.toMatch(/LOCK TABLE|pg_advisory_lock|UPDATE agents SET/);
    }
  });

  it("keeps the session read and insert in one short database transaction without relying on a unique active chat constraint", () => {
    const open = method("export async function getOrCreateChatConversation(", "/** A new session");
    expect(open).toContain("if (existing.rows[0]) return mapConversation(existing.rows[0])");
    expect(open).toContain("SELECT a.organization_id,a.id,'chat','Chat with ' || a.name");
    expect(open).toContain("RETURNING *");
    expect(open).not.toContain("ON CONFLICT");
  });
});
