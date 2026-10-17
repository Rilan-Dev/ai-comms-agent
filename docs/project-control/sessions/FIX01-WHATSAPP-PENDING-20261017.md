# FIX-01 / Sentinel — WhatsApp pending-account investigation
Date: 2026-10-17
Repository: Rilan-Dev/ai-comms-agent
Branch inspected: main
Status: source diagnosis recorded; deployed runtime issue routed to OPS-01 in #32

## Symptom
The deployed WhatsApp app shows an account as pending and outbound POST /api/whatsapp/messages returns 409 `provider_not_connected`. User also reports the add-phone flow showing an existing account, requests account editing, a Meta test account shortcut, test action placement at the end, and removing the webhook verify-token field from the initial setup details.

## Root cause established from source
The message API in `apps/web/src/app/api/whatsapp/messages/route.ts` explicitly refuses queueing unless the organization-scoped account status is `connected`. This is an intentional safety guard, not a send-queue defect.
The current `apps/web/src/app/api/whatsapp/accounts/route.ts` saves credentials encrypted and immediately calls Meta Graph API to verify the phone-number resource. It persists `connected` only when Meta responds successfully and records `error` otherwise. The worker has a separate pending-account verification path.
Consequently, the observed pending state on the deployed application does not match the expected successful path in current source. Root cause for the live deployment is not yet proven: possible deployed-source drift, database/status persistence/read mismatch, or genuine Meta credential/permission/phone-ID failure. Issue #32 routes this live environment investigation to OPS-01.

## Recent source changes reviewed
- `be18c22f`: regression assertions for immediate Meta verification.
- `d55a3b14`: credential and manual verification UI assertions.
- `5a24783a`: preserve optional phone metadata on verification retry.
- `82d22e52`: explicit retry action for pending verification.
- `7e88ef1a`: preserve existing encrypted secrets on edits.
- `64afd328`: edit mode and Meta test-phone shortcut.
- `dfd65f38`: move webhook test action to the end of the setup guide.

## Failed approaches / approaches rejected
- Do not bypass the `connected` guard to allow sends from pending accounts; this would allow unverified credentials and would hide the real failure.
- Do not treat Meta app development mode as proof that a phone is connected. Test-phone eligibility and allowed test recipients must be configured in Meta; they still require valid provider verification.
- Do not remove the server-side webhook verification mechanism. The UI may avoid exposing an autofilled verify token in the initial details, but Meta's webhook challenge still needs a matching server-side token.
- Do not infer a deployment fix from source commits or static test assertions alone.

## Remedy and prevention
- Keep outbound queueing gated on the persisted `connected` status.
- OPS-01 issue #32 must identify the deployed commit, inspect redacted Meta verification errors, confirm the intended database, and verify the status update is persisted and read back for the same organization/account.
- If deployed source is current, investigate Meta Graph API response details, token permissions, phone-number ID, app mode, and test-recipient eligibility.
- Preserve explicit edit/retry controls and make the selected account/form state unambiguous when switching between adding and editing accounts.
- Add/retain regression assertions for successful verification => persisted connected state, failed verification => actionable error state, and outbound rejection while pending/error. Add runtime integration evidence separately from static tests.

## Evidence
- Current source: `apps/web/src/app/api/whatsapp/messages/route.ts` (status gate).
- Current source: `apps/web/src/app/api/whatsapp/accounts/route.ts` (immediate Graph API verification).
- Current source: `apps/worker/src/messaging/whatsapp-worker.ts` (pending verification and send lifecycle).
- Recent commit evidence: `be18c22ffabcfb05fb0ad976ce710f6faa95c79f`, `d55a3b14adcc594e128348df80d81ac95c614ad2`, `5a24783a393226366b0446f3e60a524f8f2fb87d`, `82d22e52904cbc6fda8e84be0437cc1079e1f07f`, `7e88ef1a65279ef907363f0013a894b47c483659`, `64afd328c4ea429a6175ab296d9d208b9b9190c1`, `dfd65f3855c77cee2958af332f5bf9a3493887de`.
- OPS-01 tracking issue: https://github.com/Rilan-Dev/ai-comms-agent/issues/32
- No local checkout, live database, deployed logs, provider credentials, test run, browser E2E, or deployment verification was available in this investigation. No runtime PASS is claimed.

## Security note
A cookie-like access token was included in the user-provided curl. Treat it as exposed; revoke/rotate it and avoid placing secrets in tickets, logs, or source control.

## Next action
OPS-01 verifies deployed commit/database/provider response under issue #32. FIX-01 resumes with the smallest source correction if that evidence demonstrates a source defect; preserve all authorization checks and tenant isolation.
