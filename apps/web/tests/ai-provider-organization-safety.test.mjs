import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const setup = readFileSync(new URL("../src/app/settings/ai-provider-setup/ai-provider-setup-shared.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("../src/app/settings/ai-provider-settings.tsx", import.meta.url), "utf8");
const selector = readFileSync(new URL("../src/components/live-model-select.tsx", import.meta.url), "utf8");

test("both credential forms clear plaintext keys on organization switch", () => {
  for (const source of [setup, chat]) {
    const invalidate = source.indexOf('setLoadedOrganizationId("");');
    assert.ok(invalidate >= 0);
    const start = source.lastIndexOf("useEffect(() => {", invalidate);
    const effect = source.slice(start, invalidate + 40);
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

test("live-model selector ignores fulfilled responses from aborted previous organizations", () => {
  const json = selector.indexOf("const body = await response.json()");
  const aborted = selector.indexOf("if (controller.signal.aborted) return;", json);
  const accepted = selector.indexOf("setModels(body.models ?? [])", json);
  assert.ok(json >= 0 && aborted > json && accepted > aborted, "stale response must be discarded before rendering model IDs");
});

test("live-model selector clears previous loading state when organization is missing", () => {
  const start = selector.indexOf("if (!organizationId || !provider) {");
  const end = selector.indexOf("const controller = new AbortController()", start);
  assert.ok(start >= 0 && end > start);
  const branch = selector.slice(start, end);
  assert.ok(branch.includes("setModels([]);"));
  assert.ok(branch.includes("setLoading(false);"));
  assert.ok(branch.includes("Select an organization first."));
});
