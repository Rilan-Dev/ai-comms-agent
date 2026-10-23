import assert from "node:assert/strict";
import {test} from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const page = readFileSync(resolve(__dirname, "../src/app/settings/page.tsx"), "utf8");
const gmail = readFileSync(resolve(__dirname, "../src/app/settings/gmail-oauth-settings.tsx"), "utf8");
const zoho = readFileSync(resolve(__dirname, "../src/app/settings/zoho-oauth-settings.tsx"), "utf8");
const providers = readFileSync(resolve(__dirname, "../src/app/settings/ai-provider-settings.tsx"), "utf8");
const runtime = readFileSync(resolve(__dirname, "../src/app/settings/ai-runtime-settings.tsx"), "utf8");

test("Settings has keyboard-reachable anchors for each major settings group", () => {
  assert.match(page, /aria-label="Settings sections"/);
  for (const id of ["organization-settings", "mail-provider-settings", "ai-provider-settings", "ai-runtime-settings", "member-settings", "workspace-links"]) {
    assert.match(page, new RegExp(`id="${id}"`));
    assert.match(page, new RegExp(`href="#${id}"`));
  }
});

test("Settings preserves existing OAuth, AI provider, runtime and membership endpoints", () => {
  assert.match(page, /\/api\/settings\/organization/);
  assert.match(page, /\/api\/settings\/members/);
  assert.match(gmail, /\/api\/settings\/gmail-oauth/);
  assert.match(zoho, /\/api\/settings\/zoho-oauth/);
  assert.match(providers, /\/api\/settings\/ai-providers/);
  assert.match(runtime, /\/api\/settings\/ai-runtime/);
});

test("provider secrets stay in password inputs and are never rendered back as values", () => {
  assert.match(gmail, /type="password"/);
  assert.match(zoho, /type="password"/);
  assert.match(providers, /type="password"/);
  assert.match(gmail, /never returned to the browser/i);
  assert.match(zoho, /never returned to the browser/i);
  assert.match(gmail, /test\(notice\) \? "alert" : "status"/);
  assert.match(zoho, /test\(notice\) \? "alert" : "status"/);
});
