import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const setup = readFileSync(new URL("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("../src/app/settings/ai-provider-settings.tsx", import.meta.url), "utf8");

test("both credential forms clear plaintext keys on organization switch", () => {
  for (const source of [setup, chat]) {
    const effect = source.slice(source.indexOf("// Never"), source.indexOf("}, [organizationId]"));
    assert.ok(effect.includes('setApiKey("");'), "org switch must clear unsaved key");
    assert.ok(effect.includes("setConfigs([]);"), "org switch must clear previous tenant records");
    assert.ok(effect.includes('setLoadedOrganizationId("");'), "org switch must invalidate readiness");
  }
});

test("both forms guard writes until the currently selected organization finishes loading", () => {
  for (const source of [setup, chat]) {
    assert.ok(source.includes("loadedOrganizationId === organizationId && !loading"));
    assert.ok(source.includes("if (!organizationReady)"));
    assert.ok(source.includes("currentOrganizationId.current !== organizationId"));
  }
});

test("stale provider GET requests are aborted or ignored for both forms", () => {
  for (const source of [setup, chat]) {
    assert.ok(source.includes("new AbortController()"));
    assert.ok(source.includes("signal: controller.signal") || source.includes("load(organizationId, controller.signal)"));
    assert.ok(source.includes("return () => controller.abort()"));
  }
});

test("provider setup only renders editor after organization readiness", () => {
  assert.ok(setup.includes(") : !organizationReady ? ("));
  assert.ok(setup.includes("Retry loading"));
  assert.ok(setup.includes("const visibleConfigs = loadedOrganizationId === organizationId ? configs : [];"));
  assert.ok(setup.includes("providerConfigStatus(visibleConfigs, p, requiredPurposes)"));
});

test("organization chat provider editor fails closed and provides a retry", () => {
  assert.ok(chat.includes("!organizationReady ? ("));
  assert.ok(chat.includes("Retry loading"));
  assert.ok(chat.includes("const visibleConfigs = loadedOrganizationId === organizationId ? configs : [];"));
  assert.ok(chat.includes("organizationReady && !visibleConfigs.some"));
});

test("neither form confirms success from stale previous-organization write", () => {
  assert.ok(setup.includes("if (currentOrganizationId.current !== organizationId) return;"));
  assert.ok(chat.includes("if (currentOrganizationId.current !== organizationId) return;"));
});
