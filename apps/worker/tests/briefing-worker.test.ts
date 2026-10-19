import assert from "node:assert/strict";
import { test } from "node:test";
import { processBriefingBatch } from "../src/briefings/briefing-worker";
import type { BriefingBatchClaim } from "@ai-comms-agent/db";

const principal = { organizationId: "org-a", userId: "user-a", agentId: "agent-a" };
const claim: BriefingBatchClaim = {
  batchId: "batch-a", manifestId: "manifest-a", leaseToken: "token-a",
  workerId: "worker-a", partial: false,
  sources: [{ messageId: "msg-a", mailboxId: "mail-a", threadId: "thread-a", contentRevision: "rev-a" }],
};
const source = { ...claim.sources[0], text: "Please review this email." };
const fallback = () => ({
  claim: async () => claim, heartbeat: async () => true,
  complete: async () => {}, loadCanonicalSources: async () => [source],
  generate: async () => ({ items: [] }),
});

test("duplicate claimed jobs do not call provider or complete", async () => {
  let calls = 0;
  const deps = { ...fallback(), claim: async () => null,
    generate: async () => { calls++; return { items: [] }; },
    complete: async () => { calls++; } };
  assert.equal(await processBriefingBatch(principal, claim.manifestId, "en", deps), "unavailable");
  assert.equal(calls, 0);
});

test("revoked/deleted canonical source fails closed before generation", async () => {
  let calls = 0;
  const deps = { ...fallback(),
    loadCanonicalSources: async () => [],
    generate: async () => { calls++; return { items: [] }; } };
  await assert.rejects(processBriefingBatch(principal, claim.manifestId, "en", deps), /source mismatch/);
  assert.equal(calls, 0);
});

test("mailbox and revision isolation rejects substituted sources", async () => {
  for (const changed of [{ ...source, mailboxId: "mail-other" }, { ...source, contentRevision: "rev-other" }]) {
    let completed = false;
    await assert.rejects(processBriefingBatch(principal, claim.manifestId, "en", {
      ...fallback(), loadCanonicalSources: async () => [changed],
      complete: async () => { completed = true; },
    }), /source mismatch/);
    assert.equal(completed, false);
  }
});

test("malformed provider response persists only a partial source fallback", async () => {
  let partial: boolean | undefined;
  let items: any[] = [];
  const deps = { ...fallback(), generate: async () => "not JSON",
    complete: async (_p: unknown, _c: unknown, out: any[], isPartial: boolean) => {
      items = out; partial = isPartial;
    } };
  assert.equal(await processBriefingBatch(principal, claim.manifestId, "en", deps), "completed");
  assert.equal(partial, true);
  assert.equal(items.length, 1);
  assert.equal(items[0].representation, "partial");
});

test("expired lease fenced by heartbeat cannot complete", async () => {
  let resolveGeneration!: (value: unknown) => void;
  let called = false;
  const deps = { ...fallback(), heartbeat: async () => false,
    generate: async () => new Promise<unknown>(resolve => { resolveGeneration = resolve; }),
    complete: async () => { called = true; } };
  const run = processBriefingBatch(principal, claim.manifestId, "en", deps, "worker-a", 1);
  await new Promise(resolve => setTimeout(resolve, 15));
  resolveGeneration({ items: [] });
  await assert.rejects(run, /lease lost/);
  assert.equal(called, false);
});

test("completed batch carries the trusted principal and fenced claim", async () => {
  let observed: unknown;
  const deps = { ...fallback(), complete: async (p: unknown, c: unknown) => { observed = [p, c]; } };
  await processBriefingBatch(principal, claim.manifestId, "en", deps);
  assert.deepEqual(observed, [principal, claim]);
});
