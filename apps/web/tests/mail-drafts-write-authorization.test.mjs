import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/app/api/mail/drafts/route.ts", import.meta.url), "utf8");
const identity = readFileSync(new URL("../../../packages/shared/src/identity/types.ts", import.meta.url), "utf8");
const runtime = readFileSync(new URL("../../../packages/email-agent-runtime/src/tool-executor.ts", import.meta.url), "utf8");

function handler(method, next) {
  const start = route.indexOf("export async function " + method + "(request: Request)");
  assert.ok(start !== -1, method + " handler exists");
  const end = next ? route.indexOf("export async function " + next + "(request: Request)", start) : route.length;
  assert.ok(end > start);
  return route.slice(start, end);
}

test("all standalone draft mutations require independently granted actor email.write", () => {
  for (const [method, next] of [["POST", "PATCH"], ["PATCH", "GET"], ["DELETE", null]]) {
    const body = handler(method, next);
    assert.match(body, /authorize\(request,\s*\{ organizationId: (?:subjectRef|asOrganizationId\(organizationId\)), permission: "email\.write" \}/);
    assert.doesNotMatch(body, /role: "member"/);
    assert.match(body, /await authorize\(/);
    assert.ok(body.indexOf("await authorize(") < Math.max(body.indexOf("await createLocalDraft("), body.indexOf("await updateLocalDraftForOrganization("), body.indexOf("await deleteLocalDraftForOrganization(")));
  }
});

test("standalone draft listing keeps separate email.read requirement", () => {
  assert.match(handler("GET", "DELETE"), /authorize\(request,\s*\{ organizationId: asOrganizationId\(organizationId\), permission: "email\.read" \}/);
});

test("no existing system role silently acquires email.write from this fix", () => {
  const block = identity.slice(identity.indexOf("export const SYSTEM_ROLE_PERMISSIONS"), identity.indexOf("// Auth Subject"));
  assert.doesNotMatch(block, /"email\.write"/);
  assert.match(runtime, /context\.auth_subject\.permissions\.includes\(tool\.required_permission\)/);
});
