import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const db = readFileSync(new URL("../../../packages/db/src/email/actions.ts", import.meta.url), "utf8");
const route = readFileSync(new URL("../src/app/api/mail/actions/route.ts", import.meta.url), "utf8");
const tool = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
const exported = readFileSync(new URL("../../../packages/db/src/index.ts", import.meta.url), "utf8");

describe("FIX-01 email action idempotency is bound to requester, agent, and current approval state", () => {
  const create = db.slice(db.indexOf("export async function createEmailAction("), db.indexOf("export async function listPendingEmailActionsForOrganization("));
  it("only returns an existing pending action for the same immutable actor and agent", () => {
    expect(create).toContain("ON CONFLICT (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL");
    expect(create).toContain("email_actions.requested_by IS NOT DISTINCT FROM EXCLUDED.requested_by");
    expect(create).toContain("email_actions.agent_id IS NOT DISTINCT FROM EXCLUDED.agent_id");
    expect(create).toContain("email_actions.status = 'pending_approval'");
    expect(create).toContain("(email_actions.expires_at IS NULL OR email_actions.expires_at > now())");
    for (const field of ["email_account_id", "action_type", "content_hash", "draft_id"]) {
      expect(create).toContain("email_actions." + field);
    }
    expect(create).toContain("throw new EmailActionIdempotencyConflictError(");
    expect(create).not.toContain("SET status = 'pending_approval'");
  });

  it("refuses collisions and completed/expired action reuse rather than producing false approval receipts", () => {
    expect(exported).toContain("EmailActionIdempotencyConflictError");
    expect(route).toContain("error instanceof EmailActionIdempotencyConflictError");
    expect(route).toContain('error: "email_action_conflict"');
    expect(route).toContain("status: 409");
    expect(route).toContain("status: action.status");
    expect(route).not.toContain('status: "pending_approval",\n      message:');
    expect(tool).toContain("error instanceof EmailActionIdempotencyConflictError");
    expect(tool).toContain('code: conflict ? "email_action_conflict"');
    expect(tool).toContain("message: conflict ? error.message");
    expect(db).toContain("No new approval request was created.");
  });

  it("preserves normal human approval and state transitions without an automatic resend", () => {
    expect(db).toContain("status = 'pending_approval'");
    expect(db).toContain("AND status = 'approved'");
    expect(db).toContain("AND status = 'executing'");
    expect(route).not.toContain("connected.sendDraft");
    expect(tool).not.toContain("decideEmailAction(");
  });
});
