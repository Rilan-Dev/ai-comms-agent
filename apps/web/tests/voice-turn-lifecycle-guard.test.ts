import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(__dirname, "../src/app/api/voice/turn/route.ts"),
  "utf8",
);

describe("voice turn lifecycle guard", () => {
  it("rejects non-active sessions except the explicitly initialized transcript bridge", () => {
    expect(source).toContain('session.status !== "active" && !transcriptBridgeOnly');
    expect(source).toContain('session.status === "starting"');
    expect(source).toContain('transportMode')
    expect(source).toContain('error: "session_not_active"');
  });

  it("does not return a generated turn if the session ended before the turn was recorded", () => {
    expect(source).toContain("const turnRecorded = await incrementVoiceSessionTurnForOrganization");
    expect(source).toContain("if (!turnRecorded)");
    expect(source).toContain("Voice session ended before the turn could be recorded.");
  });
});
