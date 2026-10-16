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
    expect(route).toContain("voiceOverride: { provider: voiceProvider, model: voiceModel, voiceId }");
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

  it("does not mark a session connected merely because a descriptor was resolved", () => {
    expect(repository).toContain("SET provider = $1, model = $2, voice_id = $3, metadata = $4::jsonb");
    const configureStart = repository.slice(
      repository.indexOf("export async function configureStartingVoiceSessionForOrganization"),
      repository.indexOf("export async function activateVoiceSessionForOrganization"),
    );
    expect(configureStart).not.toContain("status = 'active'");
    expect(configureStart).not.toContain("connected_at = COALESCE");
    expect(repository).toContain("metadata->>'transportMode' = 'transcript_bridge'");
  });

  it("marks failed transport/configuration starts as terminal errors", () => {
    expect(route).toContain('endVoiceSessionForOrganization(organizationId, String(persisted.id), "error")');
    expect(route).toContain("configureStartingVoiceSessionForOrganization");
    expect(repository).toContain("status = 'starting' AND ended_at IS NULL");
  });
});
