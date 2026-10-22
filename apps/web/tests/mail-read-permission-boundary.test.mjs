import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("shared roles distinguish basic organization membership from email.read", () => {
  const roles = source("../../../packages/shared/src/identity/types.ts");
  const segment = roles.slice(roles.indexOf("export const SYSTEM_ROLE_PERMISSIONS"), roles.indexOf("// Auth Subject"));
  assert.ok(segment.includes('viewer: [\n    "organization.read",\n  ]'));
  assert.ok(!/viewer:\s*\[[^\]]*"email\.read"/.test(segment));
  assert.match(segment, /member:\s*\[[^\]]*"email\.read"/);
  assert.match(segment, /owner:\s*\[[^\]]*"email\.read"/);
});

test("every message, thread, attachment and mailbox metadata GET requires email.read", () => {
  const paths = [
    "../src/app/api/mail/inbox/route.ts",
    "../src/app/api/mail/threads/route.ts",
    "../src/app/api/mail/thread/route.ts",
    "../src/app/api/mail/attachments/route.ts",
    "../src/app/api/mail/attachments/[attachmentId]/route.ts",
    "../src/app/api/mail/messages/folder/route.ts",
    "../src/app/api/email-accounts/route.ts",
    "../src/app/api/email-accounts/[accountId]/structure/route.ts",
  ];
  for (const path of paths) {
    const route = source(path);
    const start = route.indexOf("export async function GET(");
    assert.ok(start >= 0, path + ": GET exists");
    const next = route.indexOf("export async function ", start + 22);
    const get = route.slice(start, next < 0 ? undefined : next);
    assert.match(get, /permission: "email\.read"/, path);
    assert.doesNotMatch(get, /permission: "organization\.read"/, path);
    assert.ok(get.indexOf('permission: "email.read"') < get.indexOf("ForOrganization(") || !get.includes("ForOrganization("), path);
  }
});

test("mark-read and mark-unread require email.read, not viewer organization.read", () => {
  const route = source("../src/app/api/mail/messages/read-state/route.ts");
  const patch = route.slice(route.indexOf("export async function PATCH("));
  assert.match(patch, /permission: "email\.read"/);
  assert.doesNotMatch(patch, /permission: "organization\.read"/);
  assert.match(patch, /assertSameOrigin\(request\)/);
  assert.ok(patch.indexOf('permission: "email.read"') < patch.indexOf("updateMailReadStateForOrganization("));
});

test("server-rendered inbox, threads, thread and account pages deny read before fetching mail", () => {
  const specs = [
    ["../src/app/mail/inbox/page.tsx", "listInboxMessages(organizationId"],
    ["../src/app/mail/threads/page.tsx", "listMailThreadsForOrganization(organizationId"],
    ["../src/app/mail/thread/[threadId]/page.tsx", "getMailThreadForOrganization(organizationId"],
    ["../src/app/mail/accounts/page.tsx", "listForOrganization(organizationId"],
  ];
  for (const [path, method] of specs) {
    const page = source(path);
    assert.match(page, /getAuthenticatedAppContext/);
    assert.match(page, /canReadOrganizationMail\(organizationId, context\.membership\.role\)/, path);
    assert.ok(page.indexOf("canReadOrganizationMail(organizationId, context.membership.role)") < page.indexOf(method), path);
    assert.match(page, /Mail access denied|Mailboxes unavailable|Inbox access denied|Threads access denied|Thread access denied/, path);
  }
});

test("page mail permission is from the role's persisted effective permission list, not a hardcoded rank", () => {
  const helper = source("../src/lib/mail/mail-read-access.ts");
  assert.match(helper, /getIdentityRepository\(\)\.getPermissionsForRole/);
  assert.match(helper, /asOrganizationId\(organizationId\)/);
  assert.match(helper, /permissions\.includes\("email\.read"\)/);
  assert.doesNotMatch(helper, /role === "owner"|role === "admin"/);
});

test("the email permission boundary leaves explicit draft-write and approval permissions independent", () => {
  const draft = source("../src/app/api/mail/drafts/route.ts");
  const action = source("../src/app/api/mail/actions/route.ts");
  assert.match(draft, /permission: "email\.write"/);
  assert.match(action, /permission: "organization\.update"/);
});
