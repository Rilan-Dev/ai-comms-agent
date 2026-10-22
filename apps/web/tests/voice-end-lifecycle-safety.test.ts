import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const workspace = readFileSync(new URL("../src/app/ai-voice/voice-workspace.tsx", import.meta.url), "utf8");
const endpoint = readFileSync(new URL("../src/app/api/voice/session/route.ts", import.meta.url), "utf8");
const fn = workspace.slice(workspace.indexOf("async function endSession(): Promise<boolean>"), workspace.indexOf("function toggleMute()"));
const returnToChat = workspace.slice(workspace.indexOf('aria-label="Return to text chat"') - 500, workspace.indexOf('aria-label="Return to text chat"') + 160);

describe("FIX-01 voice end lifecycle — never claim persisted end after a failed API response", () => {
  it("server only returns successful DELETE when a user-owned session was ended", () => {
    const deletion = endpoint.slice(endpoint.indexOf("export async function DELETE(request: Request)"));
    expect(deletion).toContain("session.user_id !== subject.user.id");
    expect(deletion).toContain("await endVoiceSessionForOrganization(");
    expect(deletion).toContain('if (!ended) return NextResponse.json({ error: "not_found" }');
  });
  it("requires confirmed HTTP and persisted ended state before changing the UI", () => {
    expect(fn).toContain('const response = await fetch("/api/voice/session"');
    expect(fn).toContain("if (!response.ok)");
    expect(fn).toContain('payload?.session?.status !== "ended"');
    expect(fn.indexOf("if (!response.ok)")).toBeLessThan(fn.indexOf('setSession((current) => current ? { ...current, status: "ended" }'));
  });
  it("keeps failed end retriable and never navigates away on a failed stop", () => {
    expect(fn).toContain("return false;");
    expect(fn).toContain("return true;");
    expect(fn).toContain("setError(");
    expect(returnToChat).toContain("if (ended) onReturnToChat()");
    expect(fn).toContain("setBusy(false)");
    expect(fn).toContain("stopMedia()");
  });
});
