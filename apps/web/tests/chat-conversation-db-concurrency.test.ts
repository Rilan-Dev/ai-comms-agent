import { beforeEach, describe, expect, it, vi } from "vitest";

// Deterministic two-transaction PostgreSQL simulation: the original
// SELECT-then-INSERT code observes zero rows in both concurrent callers.
// An agent row FOR UPDATE lock ensures the second transaction observes the
// first committed insertion. No production database or credentials required.
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const rows: Row[] = [];
  const held = new Map<string, Promise<void>>();
  let serial = 0;

  function reset() {
    rows.length = 0;
    held.clear();
    serial = 0;
  }

  async function withTransaction<T>(
    callback: (client: { query: (sql: string, args?: unknown[]) => Promise<{ rows: Row[] }> }) => Promise<T>,
  ): Promise<T> {
    const releases: Array<() => void> = [];
    const client = {
      async query(sql: string, args: unknown[] = []): Promise<{ rows: Row[] }> {
        const org = String(args[0] ?? "");
        const agent = String(args[1] ?? "");
        if (sql.startsWith("SELECT id FROM agents") && sql.includes("FOR UPDATE")) {
          const key = org + ":" + agent;
          const previous = held.get(key) ?? Promise.resolve();
          let unlock!: () => void;
          const current = new Promise<void>(resolve => { unlock = resolve; });
          held.set(key, previous.then(() => current));
          await previous;
          releases.push(unlock);
          return { rows: [{ id: agent }] };
        }
        if (sql.startsWith("SELECT * FROM conversations")) {
          // Force simultaneous callers to overlap if no lock is used.
          await Promise.resolve();
          await Promise.resolve();
          const existing = rows.filter(r => r.organization_id === org && r.agent_id === agent
            && r.channel === "chat" && r.status === "active");
          return { rows: existing.slice(-1) };
        }
        if (sql.startsWith("INSERT INTO conversations")) {
          const count = ++serial;
          const row: Row = {
            id: "chat-" + count, organization_id: org, agent_id: agent,
            channel: "chat", subject: sql.includes("'New chat'") ? "New chat" : "Chat with agent",
            status: "active", created_at: String(count), updated_at: String(count), last_message_at: null,
          };
          rows.push(row);
          return { rows: [row] };
        }
        throw new Error("Unexpected SQL in chat session fixture: " + sql);
      },
    };
    try { return await callback(client); }
    finally { for (const release of releases.reverse()) release(); }
  }
  return { reset, rows, withTransaction };
});

vi.mock("../../../packages/db/src/client", () => ({
  withTransaction: db.withTransaction,
  query: vi.fn(() => { throw new Error("Not part of this transaction fixture"); }),
}));

import {
  createChatConversation,
  getOrCreateChatConversation,
} from "../../../packages/db/src/conversation/repository";

describe("chat session database first-load serialization", () => {
  beforeEach(() => db.reset());

  it("two simultaneous first loads of one tenant/agent share exactly one session", async () => {
    const [a, b] = await Promise.all([
      getOrCreateChatConversation("tenant-A", "agent-A"),
      getOrCreateChatConversation("tenant-A", "agent-A"),
    ]);
    expect(a.id).toBe(b.id);
    expect(db.rows).toHaveLength(1);
  });

  it("a deliberate New Chat still creates a separate session without deleting earlier history", async () => {
    const old = await getOrCreateChatConversation("tenant-A", "agent-A");
    const fresh = await createChatConversation("tenant-A", "agent-A");
    const resumed = await getOrCreateChatConversation("tenant-A", "agent-A");
    expect(fresh.id).not.toBe(old.id);
    expect(resumed.id).toBe(fresh.id);
    expect(db.rows).toHaveLength(2);
  });

  it("agents in separate organizations never borrow each other's session", async () => {
    const [first, second] = await Promise.all([
      getOrCreateChatConversation("tenant-A", "agent-A"),
      getOrCreateChatConversation("tenant-B", "agent-A"),
    ]);
    expect(first.id).not.toBe(second.id);
    expect(first.organizationId).toBe("tenant-A");
    expect(second.organizationId).toBe("tenant-B");
    expect(db.rows).toHaveLength(2);
  });

  it("a simultaneous explicit New Chat cannot be lost by an automatic first load", async () => {
    const [automatic, fresh] = await Promise.all([
      getOrCreateChatConversation("tenant-A", "agent-A"),
      createChatConversation("tenant-A", "agent-A"),
    ]);
    expect(automatic.id).not.toBe(fresh.id);
    expect(db.rows).toHaveLength(2);
    const next = await getOrCreateChatConversation("tenant-A", "agent-A");
    expect(next.id).toBe(fresh.id);
  });
});
