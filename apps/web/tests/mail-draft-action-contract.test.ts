import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repo = readFileSync(resolve(__dirname, "../../../packages/db/src/email/repository.ts"), "utf8");
const route = readFileSync(resolve(__dirname, "../src/app/api/mail/drafts/route.ts"), "utf8");
const compose = readFileSync(resolve(__dirname, "../src/app/mail/compose/compose-client.tsx"), "utf8");
const thread = readFileSync(resolve(__dirname, "../src/app/mail/thread/[threadId]/thread-client.tsx"), "utf8");

describe("Mail draft and sensitive action contracts", () => {
  it("keeps draft list/update/delete organization scoped", () => {
    expect(repo).toContain("listLocalDraftsForOrganization");
    expect(repo).toContain("deleteLocalDraftForOrganization");
    expect(repo).toContain("m.organization_id = $2");
    expect(repo).toContain("m.is_draft = true");
  });
  it("exposes authorized draft GET and DELETE routes", () => {
    expect(route).toContain('export async function GET');
    expect(route).toContain('export async function DELETE');
    expect(route).toContain('role: "member"');
    expect(route).toContain('email.draft.deleted');
  });
  it("loads persisted drafts into compose instead of fabricating draft state", () => {
    expect(compose).toContain("requestedDraftId");
    expect(compose).toContain("/api/mail/drafts?organizationId=");
    expect(compose).toContain("setDraftId(String(d.id))");
  });
  it("routes forward through the sensitive approval API", () => {
    expect(thread).toContain('actionType: "forward_email"');
    expect(thread).toContain('"/api/mail/actions"');
    expect(thread).toContain("pending approval");
  });
});
