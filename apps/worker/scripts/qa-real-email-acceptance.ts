/**
 * Operator-only, one-shot production acceptance:
 * send a clearly marked test message FROM one connected organization mailbox
 * TO a DIFFERENT connected Gmail mailbox in the same organization.
 *
 * Never accepts arbitrary recipient input. Does not grant agent send rights.
 * Must be run with a unique, explicit marker; inspect the sent-mail provider
 * before retrying when a send outcome is uncertain.
 */
import {PostgresEmailAccountRepository,parseCredentialsMasterKey,query} from "@ai-comms-agent/db";
import {ImapSmtpAdapter} from "../src/email/imap-smtp-adapter";
import type {EmailCredentials} from "@ai-comms-agent/shared";

const marker=process.env.ACA_QA_EMAIL_MARKER?.trim();
if(process.env.ACA_QA_REAL_PROVIDER_ACCEPTANCE!=="explicitly-authorized"||!marker||!/^[A-Za-z0-9_-]{10,70}$/.test(marker)){
 throw new Error("Requires explicitly authorized QA gate and safe unique marker.");
}
const rows=await query<{id:string;email_address:string;organization_id:string;provider:string;connection_config:Record<string,unknown>}>(
 "SELECT id::text,email_address::text,organization_id::text,provider,coalesce(connection_config,'{}'::jsonb) as connection_config FROM email_accounts WHERE status='connected' AND deleted_at IS NULL AND provider IN ('gmail','imap_smtp')",
);
const to=rows.rows.filter(r=>r.provider==="gmail");
const from=rows.rows.filter(r=>r.provider==="imap_smtp");
if(to.length!==1||from.length!==1||to[0]!.organization_id!==from[0]!.organization_id||
 to[0]!.email_address.toLowerCase()===from[0]!.email_address.toLowerCase()){
 throw new Error("Exactly two distinct, connected mailbox identities in the same organization are required.");
}
const subject="Action Required: Please approve QA email "+marker;
const prior=await query<{id:string}>(
 "SELECT id::text FROM email_messages WHERE organization_id=$1 AND subject=$2 LIMIT 1",
 [to[0]!.organization_id,subject],
);
if(prior.rows.length)throw new Error("Marker was previously ingested; refusing duplicate send.");
const credKey=process.env.CREDENTIALS_MASTER_KEY;
if(!credKey)throw new Error("Credentials configuration unavailable.");
const encrypted=await new PostgresEmailAccountRepository().loadCredentials(from[0]!.id,parseCredentialsMasterKey(credKey));
if(!encrypted)throw new Error("SMTP mailbox connection has no encrypted credentials.");
const credentials={...encrypted,...from[0]!.connection_config} as unknown as EmailCredentials;
const adapter=new ImapSmtpAdapter();
try{
 await adapter.connect(credentials);
 const draft=await adapter.createDraft({
  to:[to[0]!.email_address],cc:[],bcc:[],
  subject,
  body_text:"Controlled internal acceptance test of AI Comms Agent. Could you review and approve this test request? This message asks for no external communication and requires no reply. Marker: "+marker,
 });
 console.log("QA_DRAFT_CREATED=true");
 const sent=await adapter.send(draft.draft_id);
 console.log(JSON.stringify({providerAccepted:true,provider:"imap_smtp",destination:"same-organization-connected-gmail",marker,providerMessageRefPresent:Boolean(sent.provider_message_id)}));
}finally{await adapter.disconnect().catch(()=>{});}
