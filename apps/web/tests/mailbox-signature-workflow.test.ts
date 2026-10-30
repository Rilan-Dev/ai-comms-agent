import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root = new URL("../../../", import.meta.url);
function source(path:string){return readFileSync(new URL(path,root),"utf8");}

test("Gmail onboarding exposes editor and keeps pending signature out of URLs and OAuth signed state",()=>{
 const ui=source("apps/web/src/app/mail/accounts/email-accounts-client.tsx");
 const callback=source("apps/web/src/app/api/oauth/gmail/callback/route.ts");
 const start=source("apps/web/src/app/api/oauth/gmail/start/route.ts");
 assert.match(ui,/MailboxSignatureEditor id="gmail-signature-new"/);
 assert.match(ui,/sessionStorage\.setItem\("aca:gmail-signature-pending"/);
 assert.match(ui,/fetch\("\/api\/email-accounts",\{method:"PATCH"/);
 assert.match(callback,/searchParams\.set\("accountId",account\.id\)/);
 assert.doesNotMatch(start,/signatureText|mailSignatureText/);
});
test("signature mutations are explicit, same-origin protected, admin-only and organization-scoped",()=>{
 const route=source("apps/web/src/app/api/email-accounts/route.ts");
 const repo=source("packages/db/src/email/repository.ts");
 assert.match(route,/export async function PATCH\(request:Request\)/);
 assert.match(route,/assertSameOrigin\(request\)/);
 assert.match(route,/role:"admin"/);
 assert.match(route,/normalizeMailboxSignature\(input\.signatureText\)/);
 assert.match(repo,/WHERE organization_id=\$1 AND id=\$2 AND deleted_at IS NULL RETURNING \*/);
 assert.match(repo,/jsonb_set\(coalesce\(connection_config/);
 assert.match(repo,/connection_config = \$3::jsonb \|\| jsonb_build_object\('mailSignatureText'/);
});
test("single authoritative mailbox signature is appended in all create, update and reply/forward action paths",()=>{
 const db=source("packages/db/src/email/repository.ts");
 const agent=source("packages/email-agent-runtime/src/email-write-tools.ts");
 const manual=source("apps/web/src/app/api/mail/actions/route.ts");
 assert.match(db,/const signedBody=applyMailboxSignature\(input\.bodyText\?\?"",accountResult\.rows\[0\]\.mail_signature\)/);
 assert.match(db,/applyMailboxSignature\(input\.bodyText,signatureRow\.rows\[0\]\.mail_signature\)/);
 assert.match(agent,/applyMailboxSignature\(reviewedBody\(input\.body_text, context\),account\.signature_text\)/);
 assert.match(agent,/applyMailboxSignature\(preserveEmailBody\(source\.text_body\),account\.signature_text\)/);
 assert.match(manual,/applyMailboxSignature\(/);
});
test("review UI renders the exact saved body rather than silently approving an unsigned preview",()=>{
 const manual=source("apps/web/src/app/mail/compose/compose-client.tsx");
 const chat=source("apps/web/src/app/chat/chat-client.tsx");
 const readiness=source("apps/web/src/app/api/chat/mail-compose/route.ts");
 assert.match(manual,/const signedBody=applyMailboxSignature\(bodyText/);
 assert.match(manual,/setBodyText\(String\(data\.draft\.text_body/);
 assert.match(manual,/matchesManualComposeReview\(persisted, payload\)/);
 assert.match(chat,/const previousMailbox=composeMailboxes\.find/);
 assert.match(chat,/applyMailboxSignature\(clean,selectedMailbox\.signatureText\)/);
 assert.match(readiness,/connection_config->>'mailSignatureText' AS signature_text/);
 assert.match(readiness,/getLocalDraftForOrganization\(organizationId,output\.draft_id\)/);
 assert.match(readiness,/bodyText:String\(saved\?\.text_body/);
 assert.match(chat,/setComposeBody\(data\.bodyText\)/);
});
