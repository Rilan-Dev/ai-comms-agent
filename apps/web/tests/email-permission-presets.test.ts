import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  EMAIL_PERMISSION_LABELS, EMAIL_PERMISSION_PRESETS, REGISTERED_EMAIL_POLICY_NAMES,
  emailPermissionPresetSelection, summarizeEmailPermissionChanges,
} from "../src/lib/agents/email-permission-presets";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const policyApi = read("../src/app/api/agents/[id]/policy/route.ts");
const repository = read("../../../packages/db/src/agent/repository.ts");
const chat = read("../src/app/chat/chat-client.tsx");
const detail = read("../src/app/agents/[id]/agent-detail-client.tsx");

describe("agent permission presets and consent", () => {
  it("offers only four simple presets and never enables mail tools without a choice", () => {
    expect(EMAIL_PERMISSION_PRESETS.map(p => p.id)).toEqual(["read", "draft", "approval", "off"]);
    expect(REGISTERED_EMAIL_POLICY_NAMES).toHaveLength(16);
    expect(emailPermissionPresetSelection([], "off")).toEqual([]);
    expect(emailPermissionPresetSelection([], "read")).toContain("email.search");
    expect(emailPermissionPresetSelection([], "read")).not.toContain("email.send.request");
  });

  it("draft and approval choices only widen permission after the user selects them", () => {
    const initial = ["custom.audit", "whatsapp.read"];
    const readTools = emailPermissionPresetSelection(initial, "read");
    const drafts = emailPermissionPresetSelection(readTools, "draft");
    const approvals = emailPermissionPresetSelection(drafts, "approval");
    expect(drafts).toContain("email.draft.create");
    expect(drafts).not.toContain("email.send.request");
    expect(approvals).toContain("email.send.request");
    expect(approvals).toContain("email.reply.request");
    expect(approvals).toContain("whatsapp.read");
    expect(approvals).toContain("custom.audit");
    expect(emailPermissionPresetSelection(approvals, "off")).toEqual(initial);
    expect(emailPermissionPresetSelection([...approvals, "email.legacy_unknown"], "off")).toEqual(initial);
    expect(emailPermissionPresetSelection(approvals, "approval")).toEqual(approvals);
  });

  it("produces exact, readable additions and removals for human confirmation", () => {
    const before = ["email.search", "whatsapp.read", "email.draft.create"];
    const after = ["whatsapp.read", "email.send.request", "email.draft.create"];
    const result = summarizeEmailPermissionChanges(before, after);
    expect(result.added).toEqual(["email.send.request"]);
    expect(result.removed).toEqual(["email.search"]);
    expect(result.confirmation).toContain("Enable:");
    expect(result.confirmation).toContain("Request send approval");
    expect(result.confirmation).toContain("Disable:");
    expect(result.confirmation).toContain("Search mailbox");
    expect(result.confirmation).toContain("human approval");
    expect(EMAIL_PERMISSION_LABELS["email.message.get"]).toBe("Read a message");
  });

  it("chat and full policy editor require confirmation and send original snapshots", () => {
    expect(chat).toContain("summarizeEmailPermissionChanges(mailPolicy.allowedTools, mailToolSelection)");
    expect(chat).toContain("window.confirm(confirmation)");
    expect(chat).toContain("expectedPolicy:");
    expect(chat).toContain("response.status === 409");
    expect(chat).toContain("Reload current permissions");
    expect(chat).toContain("Discard unsaved permission selections and reload the saved policy?");
    expect(chat).toContain("EMAIL_PERMISSION_LABELS[name]");
    expect(detail).toContain("summarizeEmailPermissionChanges(policy?.allowedTools ?? [], allowedTools)");
    expect(detail).toContain("window.confirm(confirmation");
    expect(detail).toContain("expectedPolicy:");
    expect(detail).toContain('type="checkbox"');
  });

  it("only administrators can update and stale snapshots receive 409 without persisting", () => {
    expect(policyApi).toContain('role: "admin"');
    expect(policyApi).toContain("validateAgentPolicyInput(body.expectedPolicy)");
    expect(policyApi).toContain("A saved policy snapshot is required.");
    expect(policyApi).toContain("repo.updatePolicy(orgId, id, input, expectedValidation?.value)");
    expect(policyApi).toContain('error: "policy_changed"');
    expect(policyApi).toContain("status: 409");
    const update = repository.slice(repository.indexOf("async updatePolicy("), repository.indexOf("async agentsForEmailAccount("));
    expect(update).toContain("UPDATE agent_policies p SET");
    expect(update).toContain("FROM agents a");
    expect(update).toContain("a.organization_id=$1 AND a.id=$2");
    for (const clause of ["p.security_policy=$8::jsonb", "p.allowed_tools=$9::text[]",
      "p.allowed_senders=$10::text[]", "p.blocked_senders=$11::text[]", "p.rate_limits=$12::jsonb"]) {
      expect(update).toContain(clause);
    }
    expect(update).toContain("updated_at=now()");
  });
});
