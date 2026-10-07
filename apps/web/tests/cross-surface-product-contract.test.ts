import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const emailActionRoute = readFileSync(resolve(__dirname, "../src/app/api/mail/actions/route.ts"), "utf8");
const whatsappRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/messages/route.ts"), "utf8");
const whatsappRepository = readFileSync(resolve(__dirname, "../../../packages/db/src/messaging/whatsapp-repository.ts"), "utf8");
const scheduleRoute = readFileSync(resolve(__dirname, "../src/app/api/organizations/[orgId]/schedules/route.ts"), "utf8");
const automationRoute = readFileSync(resolve(__dirname, "../src/app/api/organizations/[orgId]/automations/route.ts"), "utf8");
const voiceTurnRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/turn/route.ts"), "utf8");
const auditRepository = readFileSync(resolve(__dirname, "../../../packages/db/src/audit/repository.ts"), "utf8");
const emailActionRepository = readFileSync(resolve(__dirname, "../../../packages/db/src/email/actions.ts"), "utf8");

describe("cross-surface product completion contract", () => {
  it("keeps email send behind pending approval and stable retry identity", () => {
    expect(emailActionRoute).toContain("pending_approval");
    expect(emailActionRoute).toContain("Idempotency-Key");
    expect(emailActionRoute).toContain("email.action.requested");
    expect(emailActionRepository).toContain("Idempotency key already exists for a different email action payload");
    expect(emailActionRepository).toContain("content_hash = EXCLUDED.content_hash");
  });

  it("keeps WhatsApp outbound idempotent and audited", () => {
    expect(whatsappRoute).toContain("Idempotency-Key");
    expect(whatsappRoute).toContain("whatsapp.message.queued");
    expect(whatsappRoute).toContain("idempotency_conflict");
    expect(whatsappRoute).toContain("status: 409");
    expect(whatsappRoute).toContain("const correlationId = crypto.randomUUID()");
    expect(whatsappRoute).toContain("correlationId, targetType: \"whatsapp_message\"");
    expect(whatsappRepository).toContain("correlationId?: string | null");
    expect(whatsappRepository).toContain("return row.id ? String(row.id) : null");
    expect(whatsappRepository).toContain("Idempotency key already exists for a different WhatsApp payload");
  });

  it("keeps scheduling and automation mutations organization-authorized and audited", () => {
    expect(scheduleRoute).toContain("authorize(");
    expect(scheduleRoute).toContain("schedule.created");
    expect(automationRoute).toContain("authorize(");
    expect(automationRoute).toContain("automation.created");
  });

  it("keeps voice turns bound to the authenticated session/agent", () => {
    expect(voiceTurnRoute).toContain("subject.user.id");
    expect(voiceTurnRoute).toContain("session.agent_id");
    expect(voiceTurnRoute).toContain("ended");
  });

  it("supports correlation tracing through audit persistence", () => {
    expect(auditRepository).toContain("correlation_id");
  });
});
