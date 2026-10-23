import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApprovalQueueRefreshGuard } from "../src/lib/mail/approval-queue-refresh.ts";

test("an older approval queue GET can never overwrite a newer refresh", () => {
  const guard = createApprovalQueueRefreshGuard();
  const oldLoad = guard.begin();
  const newLoad = guard.begin();
  assert.equal(guard.isCurrent(oldLoad), false);
  assert.equal(guard.isCurrent(newLoad), true);
});

test("a pending GET cannot restore an action while a human decides", () => {
  const guard = createApprovalQueueRefreshGuard();
  const beforeClick = guard.begin();
  guard.invalidate(); // PATCH requested: disregard all older GETs.
  const pollDuringPatch = guard.begin();
  assert.equal(guard.isCurrent(beforeClick), false);
  guard.invalidate(); // PATCH confirmed or failed: disregard in-flight polls.
  assert.equal(guard.isCurrent(pollDuringPatch), false);
  assert.equal(guard.isCurrent(guard.begin()), true);
});

test("approval queue keeps poll status separate from mutation and never erases decision notice", () => {
  const client = readFileSync(new URL("../src/app/mail/approvals/approvals-client.tsx", import.meta.url), "utf8");
  assert.match(client, /createApprovalQueueRefreshGuard\(/);
  assert.match(client, /const \[decidingId, setDecidingId\]/);
  assert.match(client, /guardRef\.current\.isCurrent\(ticket\)/);
  assert.match(client, /guardRef\.current\.invalidate\(\)/);
  assert.match(client, /load\(\{ silent: true \}\)/);
  // A passive 5-second GET must never replace an intentional foreground
  // refresh ticket, leaving its Refresh button permanently disabled.
  assert.match(client, /if \(silent && foregroundLoadTicketRef\.current !== null\) return/);
  assert.match(client, /foregroundLoadTicketRef\.current = ticket/);
  assert.match(client, /foregroundLoadTicketRef\.current === ticket/);
  assert.match(client, /if \(!silent\) \{[\s\S]{0,160}setNotice\(null\)/);
  assert.match(client, /decisionInFlightRef\.current/);
  // An interrupted foreground Refresh must release its disabled button when
  // the user begins a PATCH that invalidates that GET.
  assert.match(client, /guardRef\.current\.invalidate\(\);\s*const requestedOrg = organizationId;\s*foregroundLoadTicketRef\.current = null;\s*setLoading\(false\)/);
  assert.match(client, /disabled=\{loading \|\| decidingId !== null\}/);
  assert.match(client, /setActions\(current => current\.filter\(a => a\.id !== actionId\)\)/);
  assert.doesNotMatch(client, /setInterval\(\(\) => \{ void load\(\); \}, 5000\)/);
});
