import { describe, expect, it } from "vitest";
import {
  EMAIL_CAPABILITIES,
  assertCapability,
  emptyCapabilitySet,
  normalizeCapabilitySet,
} from "@ai-comms-agent/shared";

describe("email capability contract", () => {
  it("defines every capability exactly once", () => {
    expect(new Set(EMAIL_CAPABILITIES).size).toBe(EMAIL_CAPABILITIES.length);
    expect(EMAIL_CAPABILITIES.length).toBe(18);
  });

  it("normalizes partial provider discovery into a complete capability set", () => {
    const capabilities = normalizeCapabilitySet({
      folders: true,
      send: true,
      sync_idle: false,
    });
    expect(capabilities.folders).toBe(true);
    expect(capabilities.send).toBe(true);
    expect(capabilities.sync_idle).toBe(false);
    expect(capabilities.archive).toBe(false);
  });

  it("starts providers fail-closed", () => {
    const capabilities = emptyCapabilitySet();
    expect(() => assertCapability(capabilities, "send")).toThrow(/not supported/);
  });

  it("allows a discovered capability", () => {
    const capabilities = normalizeCapabilitySet({ search_server_side: true });
    expect(() => assertCapability(capabilities, "search_server_side")).not.toThrow();
  });
});
