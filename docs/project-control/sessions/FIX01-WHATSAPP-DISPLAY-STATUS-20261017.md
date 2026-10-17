# FIX-01 / OPS-01 — WhatsApp account label and failed-status trace
Date: 2026-10-17

## User-reported symptoms
1. The user entered the custom WhatsApp account display name `SMTS WA`, saved it, and the UI reverted to Meta's `Test Number`.
2. A previous outbound message was queued by the API, but Meta later reported `failed` with code `131047` (the 24-hour customer-service window had expired) while the UI showed `sent`.

## Display-name root cause and source remedy
- Source trace: `apps/web/src/app/api/whatsapp/accounts/route.ts` writes the account's custom `displayName` through `createOrUpdateWhatsAppAccount`, then after a successful Graph API lookup calls `updateWhatsAppAccountStatus(..., payload.verified_name)`. That update writes Meta's verified name into the same `display_name` column and overwrites the user's label.
- Smallest correction committed to main: pass `account.display_name` first, using Meta's `verified_name` only as a fallback if the user did not set a custom name. Return the same resolved value in the POST response.
- Code commit: `fd1fda7429363091098825dbf37bba0f30be3d0f`.
- Regression test added: `apps/web/tests/whatsapp-account-display-name.test.ts`, commit `79f0e6a12511afaa07249005d24e6e50fc3c7d2b`.
- Test authored but NOT executed in this environment. Deployment of these source commits has not been confirmed here.

## WhatsApp status discrepancy — evidence and limits
- Last observed production deployment before the source fix: deployment `dpl_5zjzPd6V3uBGuMK2LppXqsRTkirK`, READY, serving commit `0e355bc75df6ab6c41ac619050be561faeb7c3e7` on `main`. This is the last observed revision, not proof of the post-fix deployment.
- Production runtime-log query for the last 30 minutes returned no matching WhatsApp logs. A wider seven-day runtime-log query was rejected because the configured Vercel plan's runtime-log retention does not cover that window.
- The available seven-day aggregated runtime-error view contains only older WhatsApp account-save DB constraint failures from Oct 10–11 (`waba_id` and `verify_token` NOT NULL violations), on older deployments. It does not include the user's exact message ID or prove the current failed-status path.
- Source trace: `apps/web/src/app/api/whatsapp/webhook/route.ts` resolves the account from the webhook phone-number ID, calls `applyWhatsAppProviderStatus` with organization/account scope and provider error, and returns an `accepted` count. `packages/db/src/messaging/whatsapp-repository.ts` updates the row only when provider message ID + organization ID + WhatsApp account ID all match. The UI reads the stored `status` from the messages endpoint.
- No access to the live PostgreSQL row or the historical webhook request/response was available. Therefore the cause of the exact UI mismatch is **not yet established**. Do not assume a race or patch status logic speculatively.

## OPS-01 handoff — OPEN
OPS-01 should:
1. Confirm the actual serving deployment/commit after commits `fd1fda7` and `79f0e6a`; don't infer deployment from GitHub merge/commit alone.
2. Retrieve the webhook delivery for the exact provider message ID using Meta's delivery log and the server's request logs, redacting credentials, phone numbers where not needed, and message body.
3. Record webhook HTTP status/body and the returned `accepted` count.
4. Query the row only within the correct organization/account scope; verify `provider_message_id`, `status`, `provider_error`, and `updated_at`. Do not dump credentials or unrelated tenant rows.
5. Compare the row with the API GET response and UI. If no row matched, check phone-number-to-account resolution and exact provider ID; if the row is failed but the UI says sent, inspect serving revision, cache/poll response, and rendering.
6. Apply a deployment/database/environment correction only if the evidence establishes that cause. If a source defect is isolated, return the minimal reproduction to FIX-01 for a focused regression.

## Known provider cause for code 131047
Meta explicitly rejected free-form text because more than 24 hours had elapsed since the customer last replied. Outside that window, use an eligible approved template or wait for a new customer reply. Queue acceptance is not provider acceptance or delivery.

## Failed approaches / prevention
- Do not treat `queued=true` as delivery confirmation.
- Do not retry the same free-form body as a remedy for error 131047.
- Do not weaken HMAC verification, organization/account scoping, or authorization.
- Keep custom app display labels distinct in behavior from Meta's verified name; Meta's value is only a fallback.
- No live status PASS, tests PASS, or deployment PASS is claimed.

## Security
The cookie-like access token previously included by the user should be revoked/rotated. It is not copied into this record.
