import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isApprovedEmailActionAccountUsable } from "../src/email/action-account-guard";

const worker = readFileSync(new URL("../src/email/action-worker.ts", import.meta.url), "utf8");
const oneShot = readFileSync(new URL("../src/email/action-executor.ts", import.meta.url), "utf8");
const repo = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");

test("a previously approved email action cannot execute after mailbox disconnection or revocation", () => {
  for (const status of ["disconnected", "revoked", "pending", "error"] as const) {
    assert.equal(isApprovedEmailActionAccountUsable({
      organization_id: "org-A", status,
    }, "org-A"), false, status);
  }
  assert.equal(isApprovedEmailActionAccountUsable({
    organization_id: "org-A", status: "connected",
  }, "org-A"), true);
});

test("an approved action cannot use a different tenant mailbox or a deleted/missing mailbox", () => {
  assert.equal(isApprovedEmailActionAccountUsable({
    organization_id: "org-B", status: "connected",
  }, "org-A"), false);
  assert.equal(isApprovedEmailActionAccountUsable(null, "org-A"), false);
  assert.match(repo, /async getById\(id: string\)[\s\S]*?deleted_at IS NULL/);
});

test("both approved email execution paths recheck the latest account before loading credentials or calling provider", () => {
  for (const [name, source] of [["scheduled worker", worker], ["direct executor", oneShot]] as const) {
    const guard = source.indexOf("isApprovedEmailActionAccountUsable(account, ");
    const load = source.indexOf("loadCredentials(");
    const provider = source.indexOf("verifyEmailProviderConnection(");
    assert.ok(guard >= 0, `${name}: approved account status must be checked`);
    assert.ok(load > guard, `${name}: revoke check must precede credential access`);
    assert.ok(provider > load, `${name}: provider call must follow credential verification`);
    assert.match(source, /throw new Error\("Email account is unavailable"\)/);
  }
});

test("no automatic send/role escalation or manual-approval bypass was added to the account guard", () => {
  const guard = readFileSync(new URL("../src/email/action-account-guard.ts", import.meta.url), "utf8");
  assert.doesNotMatch(guard, /sendDraft\(|\.send\(|approveEmailAction|SYSTEM_ROLE_PERMISSIONS/);
  assert.match(guard, /status === "connected"/);
  assert.match(guard, /organization_id === organizationId/);
});

test("account guard narrows a nullable repository account for credential access", () => {
  const maybeAccount: { organization_id: string; status: string } | null =
    { organization_id: "org-A", status: "connected" };
  if (!isApprovedEmailActionAccountUsable(maybeAccount, "org-A")) {
    throw new Error("Expected connected account");
  }
  const narrowed: { organization_id: string; status: string } = maybeAccount;
  assert.equal(narrowed.status, "connected");
  const guard = readFileSync(new URL("../src/email/action-account-guard.ts", import.meta.url), "utf8");
  assert.match(guard, /account is T/);
});
