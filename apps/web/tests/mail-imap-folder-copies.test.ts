import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

// Read the actual tenant-scoped query implementations, not a duplicate SQL copy.
const repository = readFileSync(
  new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8",
);
const section = (from: string, to?: string) => {
  const start = repository.indexOf(`export async function ${from}(`);
  if (start < 0) throw new Error(`Missing mail repository function ${from}`);
  const end = to ? repository.indexOf(`export async function ${to}(`, start) : -1;
  return repository.slice(start, end < 0 ? undefined : end);
};

describe("IMAP folder copies do not become duplicate inbox emails", () => {
  it("restricts IMAP Inbox view to actual INBOX membership before pagination", () => {
    const sql = section("listInboxMessages", "getMailMessageForOrganization");
    expect(sql).toContain("a.organization_id = $1");
    expect(sql).toContain("a.provider <> 'imap_smtp'");
    expect(sql).toContain("EXISTS (SELECT 1 FROM email_folders inbox_folder");
    expect(sql).toContain("inbox_folder.id = m.folder_id");
    expect(sql).toContain("inbox_folder.email_account_id = m.email_account_id");
    expect(sql).toContain("inbox_folder.role = 'inbox'");
    expect(sql).toContain("UPPER(inbox_folder.provider_folder_id) = 'INBOX'");
    expect(sql.indexOf("const conditions")).toBeLessThan(sql.indexOf("LIMIT $"));
    expect(sql).toContain('WHERE ${conditions.join(" AND ")}');
  });

  it("keeps messages from independent non-IMAP providers and separate accounts", () => {
    const inbox = section("listInboxMessages", "getMailMessageForOrganization");
    expect(inbox).toContain("a.provider <> 'imap_smtp'");
    expect(inbox).toContain('m.email_account_id = $${values.length}');
    const detail = section("getMailThreadForOrganization", "updateMailReadStateForOrganization");
    expect(detail).toContain("PARTITION BY m.email_account_id");
    expect(detail).toContain("a.provider = 'imap_smtp'");
    expect(detail).toContain("m.organization_id = $2 AND a.organization_id = $2");
  });

  it("collapses the same IMAP Message-ID across INBOX and All Mail in a thread", () => {
    const detail = section("getMailThreadForOrganization", "updateMailReadStateForOrganization");
    expect(detail).toContain("ROW_NUMBER() OVER (");
    expect(detail).toContain("NULLIF(BTRIM(m.internet_message_id), '') IS NOT NULL");
    expect(detail).toContain("'message:' || LOWER(BTRIM(m.internet_message_id))");
    expect(detail).toContain("'row:' || m.id::text");
    expect(detail).toContain("f.role = 'inbox'");
    expect(detail).toContain("f.email_account_id = m.email_account_id");
    expect(detail).toContain("SELECT * FROM ranked WHERE duplicate_rank = 1");
    expect(detail).toContain("m.html_body_sanitized AS html_body");
  });

  it("calculates thread count and unread count over unique visible messages", () => {
    const list = section("listMailThreadsForOrganization");
    expect(list).toContain("WITH mailbox_copies AS (");
    expect(list).toContain("PARTITION BY m.email_account_id");
    expect(list).toContain("a.provider = 'imap_smtp'");
    expect(list).toContain("'message:' || LOWER(BTRIM(m.internet_message_id))");
    expect(list).toContain("JOIN mailbox_copies copies ON copies.id = m.id AND copies.duplicate_rank = 1");
    expect(list).toContain("COUNT(*) OVER (PARTITION BY m.thread_id)::integer AS message_count");
    expect(list).toContain("t.organization_id = $1 AND t.email_account_id = a.id");
  });

  it("preserves physical folder copies and avoids destructive database changes", () => {
    for (const name of ["listInboxMessages", "getMailThreadForOrganization", "listMailThreadsForOrganization"]) {
      const text = section(name);
      const query = text.slice(0, text.indexOf("return "));
      expect(query).not.toMatch(/DELETE FROM email_messages|UPDATE email_messages|DROP TABLE/);
    }
  });
});
