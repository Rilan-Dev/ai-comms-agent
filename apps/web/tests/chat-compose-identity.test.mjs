import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const helper = () => readFileSync(new URL("../src/lib/mail/compose-identity.ts", import.meta.url), "utf8");
const route = () => readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
const ui = () => readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");

test("multiple senders always require an explicit From selection before saving", () => {
  const source = helper(), client = ui();
  assert.match(source, /mailboxes\.length === 1 \? mailboxes\[0\]!\.id : ""/);
  assert.match(client, /selectComposeSender\(mailboxes\)/);
  assert.match(client, /Choose the From address/);
  assert.match(client, /<option value="">Choose a sending address/);
  assert.match(client, /!composeAccount/);
});

test("unknown To recipient requires explicit user input, never a generated guess", () => {
  const source = ui(), handler = route();
  assert.match(source, /Who should receive this email/);
  assert.match(source, /type="email" aria-label="Email recipient"/);
  assert.match(source, /!composeTo\.trim\(\)/);
  assert.match(handler, /recipient\.length > 320/);
  assert.match(handler, /"A valid recipient/);
  assert.doesNotMatch(handler, /body\?\.recipientName.*to/);
});

test("compose GET discloses actor and agent capabilities separately from actual sending", () => {
  const source = route(), client = ui();
  assert.match(source, /actorCanWrite: trusted\.subject\.permissions\.has\("email\.write"\)/);
  assert.match(source, /draftToolEnabled: allowed\.some/);
  assert.match(source, /sendRequestToolEnabled: allowed\.some/);
  assert.match(source, /permissions: \{/);
  assert.match(source, /directSend: false/);
  assert.match(client, /Email permissions for this session/);
  assert.match(client, /Send: human approval required/);
  assert.match(source, /providerCanSend: mailbox\.capabilities\.send === true/);
});

test("only the authenticated user's stored profile is used for an editable signature", () => {
  const source = route(), client = ui(), identity = helper();
  assert.match(source, /profile: \{/);
  assert.match(source, /trusted\.subject\.user\.name/);
  assert.match(source, /trusted\.subject\.user\.email/);
  assert.match(identity, /Best regards,/);
  assert.match(identity, /profile\.name/);
  assert.match(client, /withProfileSignature\(current, profile\)/);
  assert.match(client, /Use my profile signature/);
  assert.match(client, /Profile details come from your signed-in account/);
  assert.doesNotMatch(identity, /CEO|Manager|Phone:|Job title:/);
});

test("draft and approval remain reviewed, tenant-bound and never directly send", () => {
  const handler = route(), client = ui();
  assert.match(handler, /authorize\(request,/);
  assert.match(handler, /b\.role='primary'/);
  assert.match(handler, /a\.organization_id=\$1/);
  assert.match(handler, /mayWriteComposeDraft\(trusted\.subject\.permissions\)/);
  assert.match(handler, /invokeEmailReadTool\(runtime, toolName, input, context\)/);
  assert.match(handler, /"email\.draft\.create"/);
  assert.match(handler, /"email\.send\.request"/);
  assert.doesNotMatch(handler, /sendDraft\(|\.send\(/);
  assert.match(client, /Request send approval/);
  assert.match(client, /window\.confirm\(/);
});

test("voice and chat receive authenticated profile context without overriding permission checks", () => {
  const chat = readFileSync(new URL("../src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
  const voice = readFileSync(new URL("../src/app/api/voice/turn/route.ts", import.meta.url), "utf8");
  const identity = helper();
  assert.match(identity, /composeAssistantGuidance/);
  assert.match(identity, /ask which sending address/);
  assert.match(identity, /ask the user to supply or select it/);
  assert.match(chat, /composeAssistantGuidance\(/);
  assert.match(chat, /name: subject\.user\.name, email: subject\.user\.email/);
  assert.match(voice, /composeAssistantGuidance\(/);
  assert.match(voice, /runEmailAgentTurn\(/);
  assert.match(chat, /trustedToolContext/);
});

test("tool layer fails closed for unknown From and To before creating drafts or approval", () => {
  const tool = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
  assert.match(tool, /Which From email should I use/);
  assert.match(tool, /Who should receive this email/);
  assert.match(tool, /const recipients = requireRecipients\(input\.to\)/);
  assert.match(tool, /to: recipients/);
  assert.match(tool, /requireRecipients\(draft\.to_recipients\)/);
  assert.match(tool, /"recipient_required"/);
  assert.match(tool, /canUseEmailAccountBinding\(/);
  assert.match(tool, /account\.status !== "connected"/);
});
