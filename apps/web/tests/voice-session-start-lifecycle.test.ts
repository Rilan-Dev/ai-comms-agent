import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const route = readFileSync(
  resolve(__dirname, "../src/app/api/voice/session/route.ts"),
  "utf8",
);
const repository = readFileSync(
  resolve(__dirname, "../../../packages/db/src/voice/repository.ts"),
  "utf8",
);

describe("voice session start lifecycle", () => {
  it("persists a starting session before requesting realtime transport", () => {
    const createIndex = route.indexOf("const persisted = await createVoiceSession");
    const transportIndex = route.indexOf("await claraRuntime.startRealtimeSession");
    expect(createIndex).toBeGreaterThanOrEqual(0);
    expect(transportIndex).toBeGreaterThan(createIndex);
  });

  it("does not label the HTTP transcript bridge as a realtime session endpoint", () => {
    const runtime = readFileSync(
      resolve(__dirname, "../../../packages/clara-core/src/runtime.ts"),
      "utf8",
    );
    expect(runtime).toContain('transportMode: "transcript_bridge" as const');
    expect(runtime).toContain('turnEndpoint: "/api/voice/turn"');
    expect(runtime).not.toContain('sessionEndpoint: "/api/voice/turn"');
  });

  it("marks failed transport/configuration starts as terminal errors", () => {
    expect(route).toContain('endVoiceSessionForOrganization(organizationId, String(persisted.id), "error")');
    expect(route).toContain("configureStartingVoiceSessionForOrganization");
    expect(repository).toContain("status = 'starting' AND ended_at IS NULL");
  });
});
