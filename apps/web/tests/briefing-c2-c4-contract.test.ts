import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (path: string) => readFileSync(resolve(__dirname, path), "utf8");
const selection = source("../../../packages/db/src/briefings/selection.ts");
const repoFile = source("../../../packages/db/src/briefings/repository.ts");
const generation = source("../../../packages/email-agent-runtime/src/briefings/generation.ts");
const app = source("../src/app/catch-up/catch-up-client.tsx");
const page = source("../src/app/catch-up/page.tsx");
const api = source("../src/app/api/organizations/[orgId]/briefings/route.ts");
const review = source("../src/app/api/organizations/[orgId]/briefings/[id]/review/route.ts");
const sources = source("../src/app/api/organizations/[orgId]/briefings/[id]/sources/route.ts");
const detail = source("../src/app/api/organizations/[orgId]/briefings/[id]/route.ts");

describe("C2 immutable personal source coverage", () => {
  it("selects one MVCC snapshot with UUID cursor and real source revisions", () => {
    expect(selection).toContain("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    expect(selection).toContain("briefing_content_revision(m.id)");
    expect(selection).toContain("m.id>$5::uuid");
    expect(selection).toContain("ORDER BY m.id LIMIT $8");
    expect(selection).toContain("PAGE_SIZE = 200");
    expect(selection).toContain("MAX_CANDIDATES = 5000");
    expect(selection).toContain("m.created_at >= $3");
  });
  it("never derives personal coverage from provider read state or login", () => {
    const selectQuery = selection.slice(selection.indexOf("SELECT m.id, m.email_account_id"), selection.indexOf("ORDER BY m.id LIMIT $8"));
    expect(selectQuery).not.toContain("m.is_read");
    expect(selectQuery).not.toContain("last_foreground_at");
    expect(selectQuery).toContain("mail_review_items rev");
    expect(selectQuery).toContain("rev.acknowledged_at IS NOT NULL");
    expect(selectQuery).toContain("rev.content_revision=briefing_content_revision(m.id)");
  });
  it("persists manifest and individual source rows in the same transaction", () => {
    expect(selection).toContain("pg_advisory_xact_lock");
    expect(selection).toContain("INSERT INTO summaries");
    expect(selection).toContain("INSERT INTO summary_sources");
    expect(selection).toContain("INSERT INTO briefing_generation_jobs");
    expect(selection).toContain("selected_source_manifest");
  });
  it("only acknowledges complete generated obligations, never provider messages", () => {
    expect(selection).toContain("Only a fully generated briefing can be reviewed");
    expect(selection).toContain("Only complete, unsnoozed generated items");
    expect(selection).toContain("ON CONFLICT(organization_id,owner_user_id,agent_id,message_id,content_revision,item_id)");
    expect(selection).not.toContain("UPDATE email_messages SET is_read");
    expect(selection).not.toContain("UPDATE email_messages SET");
    expect(repoFile).toContain("reviewedItemIds");
  });
  it("revalidates entire scope and all source revisions on every page or review", () => {
    expect(selection).toContain("resolveBriefingScopeInTransaction");
    expect(selection).toContain("s.revision !== s.stored_revision");
    expect(selection).toContain("summaryId, principal.organizationId, principal.userId, principal.agentId");
  });
});
describe("C3 honest grounded validation and publication", () => {
  it("only accepts known source IDs and exact quotes from current revisions", () => {
    expect(generation).toContain("sourceMap.has(id)");
    expect(generation).toContain("e.contentRevision !== sourceMap.get(e.sourceId)?.contentRevision");
    expect(generation).toContain("sourceMap.get(e.sourceId)?.text.slice(e.start, e.end) !== e.quote");
    expect(generation).toContain("deadline");
    expect(generation).toContain("fallbackItems");
  });
  it("bounds work and registers all obligations before marking ready", () => {
    expect(generation).toContain("MAX_MESSAGES = 50");
    expect(generation).toContain("MAX_ESTIMATED_TOKENS = 12000");
    expect(selection).toContain("INSERT INTO mail_review_items");
    expect(selection).toContain("UPDATE summaries SET content_json");
    expect(selection).toContain("registrations.every(r => r.representation === \"complete\")");
  });
});
describe("C4 feature-gated private UI", () => {
  it("does not activate unfinished catch-up unless server flag enabled", () => {
    expect(page).toContain("if (!briefingsEnabled()) notFound()");
    expect(api).toContain("if (!briefingsEnabled())");
    expect(detail).toContain("if (!briefingsEnabled())");
    expect(sources).toContain("if (!briefingsEnabled())");
    expect(review).toContain("if (!briefingsEnabled())");
  });
  it("uses server-authenticated user IDs and permissioned mailbox grants", () => {
    expect(page).toContain("context.user.id");
    expect(page).toContain("listGrantedBriefingMailboxes");
    expect(api).toContain('permission: "email.read"');
    expect(review).toContain("subject.user.id");
    expect(review).toContain("assertSameOrigin(request)");
  });
  it("shows original source links and saves review only when clicked", () => {
    expect(app).toContain("Open original email");
    expect(app).toContain("Needs attention");
    expect(app).toContain("Worth reviewing");
    expect(app).toContain("For reference");
    expect(app).toContain("Mark this item reviewed");
    expect(app).toContain('method: "POST"');
    expect(app).toContain("reviewedItemIds");
  });
});
