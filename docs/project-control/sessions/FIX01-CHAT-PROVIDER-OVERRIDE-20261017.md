# FIX-01 / Sentinel — Chat ignores saved Sarvam/Gemini provider overrides
Date: 2026-10-17

## Symptom
- User configured AI providers (Sarvam, Gemini, ElevenLabs) and set the agent's chat provider override to Sarvam AI.
- `POST /api/chat/stream` returned `internal_server_error`: `AI provider openai is not configured. Set the corresponding server-side API key.`
- User-provided Docker logs show Next.js started successfully, while `[chat/stream]` repeatedly throws the same OpenAI configuration error. Worker reports DB and credential master key configured.
- The request includes organization ID and agent ID; the web route passes both to `claraRuntime.createChatTurn({ orgId, agentId, ... })`.

## Recent-commit trace
- The recent main commits at the time of investigation are documentation updates for the prior WhatsApp incident and do not touch chat provider resolution.
- The relevant feature-introducing commit is `4dc991fa5616f9a04ed3050a7c748e489c6e75f5` (AI Provider Setup and per-agent configuration), which added `organizationAIConfig` in `packages/clara-core/src/runtime.ts`, provider configuration CRUD, migration 0044, and the per-agent settings UI/API.
- Current chat route `apps/web/src/app/api/chat/stream/route.ts` correctly passes `agentId`; therefore the first defect is not the chat route dropping the agent ID.

## Root cause (source-level, conditional runtime branch)
- In `packages/clara-core/src/runtime.ts`, `organizationAIConfig(orgId, agentId)` queried `organization_ai_runtime_settings` and immediately returned `null` if that organization-defaults row did not exist.
- That early return occurred **before** querying `agent_ai_settings` and `ai_provider_configs`. Consequently, even a persisted per-agent `chat_provider='sarvam'` override and encrypted Sarvam credential were skipped. `createChatTurn` then fell back to `selectedProvider()`, which defaults to `openai`, producing the exact reported missing-OpenAI-key error.
- This is a real source defect in the missing-org-defaults branch. Live DB evidence was not available here, so OPS-01 must confirm whether the affected organization actually lacks that row. If it does exist, continue checking whether the per-agent override row/provider credential row is present and enabled; don't claim this branch alone explains the production event until confirmed.

## Smallest source remedy
- Removed the early return for a missing organization-defaults row and supplied safe runtime defaults instead, allowing the resolver to continue into the per-agent override lookup and saved provider credential lookup.
- Organization defaults remain inherited when present; an explicit per-agent provider still takes precedence.
- Source commit: `8d7aecc8fc4b4b23fb4ecd10946da1bd51042ab0`.
- Added static regression test `apps/web/tests/clara-agent-provider-resolution.test.ts` to protect the no-org-defaults path and ensure the per-agent query/provider precedence remain present.
- Test commits: `d9e6c619320390c5290c04d29d30187a6838736f` (test creation), `c0e0a31e788ecd24e6af89f42e4f67f5100b7c73` (fixture path correction).

## Failed approaches / non-remedies
- Do not add an OpenAI key just to suppress the error: the user intentionally selected Sarvam, and this would mask incorrect provider selection.
- Do not change the chat route's provider based on request-body input; provider selection must continue to come from persisted, authorized org/agent settings.
- Do not treat container health/startup as proof that chat provider resolution works.
- Do not change voice, embedding, email, WhatsApp, auth, or unrelated provider adapters for this symptom.

## OPS-01 handoff — OPEN
1. Confirm the deployed/source revision running at `aca.starcitytechnical.com` and the self-hosted `infra-web-1` container. They may not be the same deployment.
2. In the correct organization scope, inspect only non-secret configuration metadata: whether `organization_ai_runtime_settings` row exists; `agent_ai_settings.chat_provider/chat_model`; and `ai_provider_configs` row for provider `sarvam`, purpose `chat`, `enabled`, and whether a key exists. Never output key material.
3. Build/restart the web app from a revision containing `8d7aecc` using the existing manual deployment procedure. Check sanitized logs after one chat request; verify provider resolution selects Sarvam and that no OpenAI key is required for that turn.
4. If the organization-defaults row exists, correlate agent override and provider-config rows; fix missing/disabled DB/environment state within OPS-01 scope. If runtime still resolves OpenAI on the patched revision despite a persisted Sarvam override, return the minimal repro to FIX-01.

## Verification status
- Source inspected and correction committed to main.
- Regression test authored, not run. No typecheck, build, test-suite, deployed revision, provider API, or live DB verification was performed in this session.
- No production PASS is claimed.

## Prevention lesson
- Per-agent overrides must not depend on an organization-defaults row existing. Resolve tenant-scoped agent settings independently, use organization defaults only as inheritance, and keep provider selection grounded in saved configuration—not a process-level default when a persisted override exists.
- API keys are secrets; rotate/revoke the cookie-like access token included in the user's curl, and do not copy it into project records.
