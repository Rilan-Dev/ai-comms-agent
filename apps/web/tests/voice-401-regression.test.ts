// Regression protection for the /ai-voice 401 fix (commit 610d4018).
// Verifies the resolveVoice credential check + /api/voice/realtime route
// no longer accept chat-purpose OpenAI keys for the OpenAI Realtime API.
//
// Background:
//   Before the fix, both packages/clara-core/src/runtime.ts:resolveVoice
//   and apps/web/src/app/api/voice/realtime/route.ts used
//   `purpose IN ('realtime','chat')` to look up an OpenAI credential.
//   Chat-purpose keys lack OpenAI Realtime API scope, so
//   https://api.openai.com/v1/realtime/calls rejected them with HTTP 401.
//   That made /ai-voice unusable for any org that had only chat-purpose
//   OpenAI keys configured (the common case for orgs using Sarvam for
//   chat while leaving realtime_voice_provider defaulted to "openai").
//
//   The fix requires a dedicated realtime-purpose OpenAI key. Without one,
//   resolveVoice returns transportMode="transcript_bridge" (host relays
//   recognized speech to LLM via /api/voice/turn, then TTS-synthesizes the
//   answer with the org's configured TTS provider — Sarvam in this case).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtimePath = resolve(__dirname, "../../../packages/clara-core/src/runtime.ts");
const runtimeSource = readFileSync(runtimePath, "utf8");
const routePath = resolve(__dirname, "../src/app/api/voice/realtime/route.ts");
const routeSource = readFileSync(routePath, "utf8");

describe("ISS-VOICE-401 — /ai-voice 401 fix (realtime-purpose key required)", () => {
  it("resolveVoice SQL filters to purpose='realtime' only (no chat fallback)", () => {
    // The SQL must NOT use `purpose IN ('realtime','chat')` in an actual
    // query string. Only `purpose='realtime'` is acceptable — chat-purpose
    // keys lack OpenAI Realtime API scope.
    // NOTE: the comment block at line ~625-639 mentions the OLD pattern
    // as part of explaining what was removed; the test must allow that
    // comment while still rejecting a real SQL fallback. We strip all
    // single-line // comments before checking.
    const codeOnly = runtimeSource
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(codeOnly).toContain("provider='openai' AND purpose='realtime'");
    // The actual SQL string is inside a template literal that starts with
    // "SELECT encrypted_api_key, enabled FROM ai_provider_configs WHERE
    // organization_id=$1 AND provider='openai' AND purpose='realtime' LIMIT 1"
    // — verify the SQL line specifically, not just any mention of the pattern.
    expect(runtimeSource).toMatch(/SELECT encrypted_api_key, enabled FROM ai_provider_configs WHERE organization_id=\$1 AND provider='openai' AND purpose='realtime' LIMIT 1/);
    // The OLD SQL pattern (purpose IN ('realtime','chat')) must NOT appear
    // as part of an actual SELECT statement.
    expect(runtimeSource).not.toMatch(/SELECT[^\n;]*purpose IN \('realtime','chat'\)/);
  });

  it("resolveVoice comment documents the security rationale", () => {
    // The fix must include a comment explaining WHY chat-purpose keys
    // are insufficient, so a future reviewer doesn't re-add the
    // chat-purpose fallback.
    expect(runtimeSource).toContain("SECURITY: only a dedicated REALTIME-purpose OpenAI credential");
    expect(runtimeSource).toContain("chat-purpose keys lack realtime API scope");
  });

  it("resolveVoice returns transcript_bridge when no realtime-purpose key exists", () => {
    // The fallback path must be transcript_bridge (host relays STT+chat+TTS),
    // NOT a 401 from OpenAI. Verify the transcript_bridge branch exists.
    expect(runtimeSource).toContain('transportMode: "transcript_bridge" as const');
    expect(runtimeSource).toContain("transportMode: \"realtime\" as const");
    // The realtime branch must be gated on hasOpenAIRealtimeCredential
    expect(runtimeSource).toContain("if (provider === \"openai\" && hasOpenAIRealtimeCredential)");
  });

  it("/api/voice/realtime route does NOT fall back to chat-purpose key", () => {
    // The route must NOT have a fallback query for purpose='chat'.
    // Only purpose='realtime' may be used to call OpenAI Realtime API.
    expect(routeSource).toContain("provider='openai' AND purpose='realtime'");
    expect(routeSource).not.toContain("provider='openai' AND purpose='chat'");
  });

  it("/api/voice/realtime route returns actionable 503 when no realtime key", () => {
    // When no realtime-purpose key is configured, the route must return
    // a clear 503 with a message directing the user to add a dedicated
    // 'realtime'-purpose key OR switch to a non-OpenAI voice provider.
    expect(routeSource).toContain("realtime_not_configured");
    expect(routeSource).toContain("Add a dedicated 'realtime'-purpose OpenAI key");
    expect(routeSource).toContain("switch the org's realtime voice provider to a non-OpenAI option");
  });
});
