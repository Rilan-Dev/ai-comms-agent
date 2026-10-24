(async function runIssue47BrowserAcceptance() {
  "use strict";
  // Paste only into DevTools for a signed-in, owner-authorized test session.
  // This script creates a pending approval, never approves or sends.
  const prefix = "[WhatsApp #47]";
  const note = (...parts) => console.log(prefix, ...parts);
  const fail = (message) => { throw new Error(message); };
  const origin = window.location.origin;
  const location = new URL(origin);
  if (location.protocol !== "https:" && !(location.protocol === "http:" && ["localhost", "127.0.0.1"].includes(location.hostname))) {
    fail("Use an HTTPS application origin (or localhost).");
  }
  if (!window.confirm("Issue #47 acceptance test: create ONE pending WhatsApp approval, read Meta templates and test negative API cases. No approval or send. Continue?")) {
    note("CANCELLED: no requests issued."); return;
  }
  const organizationId = window.prompt("Test organization UUID (from your authorized tenant):", "")?.trim() ?? "";
  const accountId = window.prompt("Connected WhatsApp account UUID (same tenant):", "")?.trim() ?? "";
  const recipient = window.prompt("E.164 WhatsApp recipient you control, e.g. +91... (not printed):", "")?.trim() ?? "";
  const confirmation = window.prompt('Type PENDING ONLY to authorize one pending-approval record (no send):', "")?.trim() ?? "";
  const unauthorizedOrgId = window.prompt("OPTIONAL: known inaccessible organization UUID for cross-tenant denial test (blank = NOT_RUN):", "")?.trim() ?? "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(organizationId) || !uuid.test(accountId) || !/^\+[1-9]\d{7,14}$/.test(recipient) || confirmation !== "PENDING ONLY") {
    note("CANCELLED: invalid tenant/account/recipient or explicit confirmation missing."); return;
  }

  const getTemplatesUrl = "/api/whatsapp/templates?organizationId=" + encodeURIComponent(organizationId) + "&accountId=" + encodeURIComponent(accountId);
  const path = "/api/whatsapp/messages";
  const postHeaders = { "content-type": "application/json" };
  const content = "Issue 47 pending approval acceptance test. DO NOT APPROVE OR SEND.";
  const proposal = { organizationId, accountId, to: recipient, body: content };
  const idem = "issue47-" + crypto.randomUUID();
  const fetchSafe = async (resource, options) => {
    const response = await fetch(resource, { cache: "no-store", ...options });
    return response;
  };

  try {
    const anonymous = await fetchSafe(getTemplatesUrl, { method: "GET", credentials: "omit" });
    if (![401, 403].includes(anonymous.status)) fail("anonymous template read NOT denied: HTTP " + anonymous.status);
    note("PASS: anonymous template read denied, HTTP", anonymous.status);

    const templatesResponse = await fetchSafe(getTemplatesUrl, { method: "GET", credentials: "same-origin" });
    if (templatesResponse.status !== 200) fail("authenticated Meta template synchronization NOT verified: HTTP " + templatesResponse.status);
    const data = await templatesResponse.json();
    if (!Array.isArray(data?.templates)) fail("template sync returned an invalid response shape");
    const statuses = { pending: 0, approved: 0, rejected: 0 };
    for (const item of data.templates) {
      if (!Object.prototype.hasOwnProperty.call(statuses, item?.status)) fail("unexpected template status in sync response");
      statuses[item.status]++;
    }
    note("PASS: authenticated GET template sync HTTP 200; template status counts:", statuses);
    if (data.templates.length === 0) note("INCOMPLETE: no templates returned; cannot confirm real status reconciliation.");
    if (unauthorizedOrgId) {
      if (!uuid.test(unauthorizedOrgId) || unauthorizedOrgId === organizationId) fail("cross-tenant test UUID must be different and valid");
      const foreignGet = await fetchSafe("/api/whatsapp/templates?organizationId=" + encodeURIComponent(unauthorizedOrgId) + "&accountId=" + encodeURIComponent(accountId), { method: "GET", credentials: "same-origin" });
      if (![403, 404].includes(foreignGet.status)) fail("cross-tenant read was NOT denied: HTTP " + foreignGet.status);
      note("PASS: cross-tenant read denied HTTP", foreignGet.status);
    } else {
      note("INCOMPLETE: cross-tenant negative check NOT_RUN (no inaccessible tenant UUID provided).");
    }

    const invalidPhone = await fetchSafe(path, {
      method: "POST", credentials: "same-origin", headers: postHeaders,
      body: JSON.stringify({ ...proposal, to: recipient.slice(1) }),
    });
    if (invalidPhone.status !== 422) fail("invalid E.164 was not rejected: HTTP " + invalidPhone.status);
    note("PASS: invalid phone HTTP 422");

    const sendProposal = (body) => fetchSafe(path, {
      method: "POST", credentials: "same-origin",
      headers: { ...postHeaders, "Idempotency-Key": idem },
      body: JSON.stringify(body),
    });
    const first = await sendProposal(proposal);
    if (first.status !== 202) fail("pending proposal NOT accepted: HTTP " + first.status);
    const pending = await first.json();
    if (pending?.approvalRequired !== true || pending?.status !== "pending" || !uuid.test(pending?.actionId ?? "")) {
      fail("202 response did not contain a pending approval record");
    }
    note("PASS: authorized proposal HTTP 202, pending approval (not a send)");
    // Preserve the action ID immediately: later assertions can fail after the row exists.
    note("Action ID (keep private, only for local psql -v action_id):", pending.actionId);

    const repeated = await sendProposal(proposal);
    if (repeated.status !== 202) fail("identical idempotent retry failed: HTTP " + repeated.status);
    const repeatData = await repeated.json();
    if (repeatData?.actionId !== pending.actionId || repeatData?.status !== "pending") fail("idempotent retry did not preserve the same pending action");
    note("PASS: identical idempotency key retained one action");

    const conflict = await sendProposal({ ...proposal, body: content + " changed" });
    if (conflict.status !== 409) fail("reused idempotency key with changed payload was not rejected: HTTP " + conflict.status);
    note("PASS: changed payload with same idempotency key HTTP 409");
    note("DB CHECK REQUIRED: locally verify actionId via scripts/tests/whatsapp-issue47-pending.postgres.sql");
    note("HTTP checks passed. No approval or send endpoint was invoked by this test.");
  } catch (error) {
    note("NOT ACCEPTED:", error instanceof Error ? error.message : "unknown test error");
    note("Check live permissions/provider readiness without pasting cookies, private phone numbers or message bodies.");
  }
})();
