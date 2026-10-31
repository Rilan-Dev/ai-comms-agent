import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planOverviewRead } from "../src/lib/overview/permission-plan.ts";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("viewer cannot see mailbox counts, approvals or audit events through Overview", () => {
  const view = planOverviewRead(new Set(["organization.read"]));
  assert.equal(view.mail, false);
  assert.equal(view.approvals, false);
  assert.equal(view.audit, false);
  assert.equal(view.agents, true);
});

test("email.read alone never grants audit or send-approval visibility", () => {
  const view = planOverviewRead(new Set(["organization.read", "email.read"]));
  assert.equal(view.mail, true);
  assert.equal(view.approvals, false);
  assert.equal(view.audit, false);
});

test("audit.read and organization.update independently grant only their exact data", () => {
  const audit = planOverviewRead(new Set(["organization.read", "audit.read"]));
  assert.equal(audit.audit, true);
  assert.equal(audit.mail, false);
  assert.equal(audit.approvals, false);
  const approvals = planOverviewRead(new Set(["organization.read", "organization.update"]));
  assert.equal(approvals.approvals, true);
  assert.equal(approvals.mail, false);
  assert.equal(approvals.audit, false);
});

test("Overview excludes forbidden SQL reads rather than only redacting their results", () => {
  const route = read("../src/app/api/overview/route.ts");
  assert.match(route, /planOverviewRead\(subject\.permissions\)/);
  assert.match(route, /access\.mail\s*\?/);
  assert.match(route, /access\.approvals\s*\?/);
  assert.match(route, /access\.audit \? await query/);
  assert.match(route, /NULL::bigint AS unread_mail/);
  assert.match(route, /NULL::bigint AS action_required/);
  assert.match(route, /NULL::bigint AS pending_approvals/);
  assert.match(route, /value == null \? null : Number\(value\)/);
  assert.match(route, /activity: access\.audit \?/);
  assert.ok(route.indexOf("planOverviewRead(subject.permissions)") < route.indexOf("const counts = await query<"));
});

test("Overview shows restricted status instead of zero or falsely empty audit trail", () => {
  const client = read("../src/app/overview/page.tsx");
  assert.match(client, /metrics: Record<string, number \| null>/);
  assert.match(client, /activity: .*\[\] \| null/);
  assert.match(client, /Access restricted/);
  assert.match(client, /Requires access/);
  assert.match(client, /data\.activity === null/);
  assert.match(client, /No activity has been recorded yet\./);
});
