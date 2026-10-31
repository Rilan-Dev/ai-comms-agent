const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const base = process.env.ACA_QA_URL || "https://aca.starcitytechnical.com";
  const org = process.env.ACA_QA_ORG;
  const key = "qa-browser-manager-20261031-v1";
  if (!org || !process.env.ACA_QA_EMAIL || !process.env.ACA_QA_PASSWORD) throw Error("QA login and org are required");
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
    await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
    await page.locator('input[type="email"]').fill(process.env.ACA_QA_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.ACA_QA_PASSWORD);
    await page.getByRole("button", { name: /Sign in/ }).click();
    await page.waitForURL(url => url.pathname !== "/login", { timeout: 25000 });
    console.log("LOGIN_BROWSER_OK");
    await page.goto(base + "/work-items", { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "Business work items" }).waitFor();
    const get = async () => page.evaluate(async orgId => {
      const r = await fetch("/api/organizations/" + orgId + "/work-items", { cache: "no-store" });
      return { code: r.status, data: await r.json() };
    }, org);
    let response = await get();
    assert.equal(response.code, 200);
    const fixture = response.data.items.find(i => i.source_event_key === key);
    assert.ok(fixture, "QA fixture missing");
    assert.equal(fixture.status, "new");
    assert.equal(fixture.review_status, "pending");
    const owner = response.data.assignees.find(a => ["owner", "admin"].includes(a.role));
    assert.ok(owner, "manager not assignable");
    const item = page.locator("article").filter({ hasText: "[QA Browser] Reader site access service ticket" });
    await item.waitFor();
    const denied = await page.evaluate(async v => {
      const r = await fetch("/api/organizations/" + v.org + "/work-items", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: v.id, status: "completed" }),
      });
      return r.status;
    }, { org, id: fixture.id });
    assert.equal(denied, 409, "premature completion allowed");
    console.log("PREMATURE_CLOSE_DENIED");
    await item.locator('select[aria-label^="Assign"]').selectOption(owner.id);
    await item.getByRole("button", { name: "Approve (admin)" }).click();
    await item.getByText("Review: approved").waitFor({ timeout: 15000 });
    await item.locator('select[aria-label^="Status"]').selectOption("in_progress");
    await item.locator('select[aria-label^="Status"]').selectOption("completed");
    response = await get();
    const value = response.data.items.find(i => i.id === fixture.id);
    assert.equal(value.status, "completed");
    assert.equal(value.review_status, "approved");
    assert.equal(value.assigned_user_id, owner.id);
    assert.ok(value.reviewed_by && value.closed_at);
    const anonymous = await browser.newContext();
    const guest = await anonymous.request.get(base + "/api/organizations/" + org + "/work-items");
    assert.ok([401, 403].includes(guest.status()));
    await anonymous.close();
    fs.mkdirSync("/qa/artifacts", { recursive: true });
    await page.screenshot({ path: "/qa/artifacts/manager-acceptance.png", fullPage: true });
    console.log("BROWSER_MANAGER_FLOW_PASS " + JSON.stringify({ assigned: true, approved: true, completed: true, reviewed: true, unauthorizedDenied: guest.status() }));
  } finally { await browser.close(); }
})().catch(e => { console.error("BROWSER_MANAGER_FLOW_FAILED", String(e.message).slice(0, 900)); process.exitCode = 1; });
