/**
 * Explicitly gated, signed webhook acceptance probe. It exercises the real
 * Next.js POST route using the organization's saved encrypted app secret.
 * It does NOT claim Meta delivered this event, and uses a fictional 555
 * number and an empty-body message to prevent any outbound reply request.
 */
import {createHmac} from "node:crypto";
import {listWhatsAppAccountsForOrganization,loadWhatsAppCredential,parseCredentialsMasterKey,query} from "@ai-comms-agent/db";
const marker=process.env.ACA_QA_WHATSAPP_MARKER?.trim();
if(process.env.ACA_QA_SIGNED_WEBHOOK_ACCEPTANCE!=="explicitly-authorized"||!marker||!/^qa-signed-[a-z0-9-]{12,70}$/.test(marker))throw new Error("Explicit QA gate and unique qa-signed marker are required.");
const rows=await query<{id:string;organization_id:string;phone_number_id:string;business_account_id:string|null}>(
 "SELECT id::text,organization_id::text,phone_number_id,business_account_id FROM whatsapp_accounts WHERE status='connected' AND deleted_at IS NULL AND phone_number_id<>'__webhook_config__' ORDER BY connected_at DESC LIMIT 1"
);
const account=rows.rows[0];
if(!account)throw new Error("No configured real WhatsApp phone.");
const all=await listWhatsAppAccountsForOrganization(account.organization_id);
const config=all.find(a=>a.phone_number_id==="__webhook_config__");
const rawKey=process.env.CREDENTIALS_MASTER_KEY;
if(!rawKey)throw new Error("No encryption key configured.");
const key=parseCredentialsMasterKey(rawKey);
let appSecret="";
for(const accountId of [config?.id,account.id]){
 if(!accountId)continue;
 const stored=await loadWhatsAppCredential(accountId,account.organization_id,key);
 const value=stored?.app_secret;
 if(typeof value==="string" && value){appSecret=value;break;}
}
if(!appSecret)throw new Error("No organization-scoped webhook signature secret configured.");
const payload=JSON.stringify({
 object:"whatsapp_business_account",
 entry:[{id:account.business_account_id??"qa-business",changes:[{
  field:"messages",
  value:{
   messaging_product:"whatsapp",
   metadata:{phone_number_id:account.phone_number_id},
   contacts:[{wa_id:"12025550141",profile:{name:"QA Fictional Test Contact"}}],
   messages:[{id:marker,from:"12025550141",timestamp:String(Math.floor(Date.now()/1000)),type:"unknown"}]
  }
 }]}]
});
const endpoint=process.env.ACA_QA_LOCAL_WEBHOOK_URL??"http://web:3000/api/whatsapp/webhook";
const fake=await fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-hub-signature-256":"sha256="+"0".repeat(64)},body:payload});
if(fake.status!==403)throw new Error("Unsigned/incorrect-signature webhook must be rejected, got "+fake.status);
const sig="sha256="+createHmac("sha256",appSecret).update(payload).digest("hex");
const post=()=>fetch(endpoint,{method:"POST",headers:{"content-type":"application/json","x-hub-signature-256":sig},body:payload});
const first=await post();
const firstBody=await first.text();
if(!first.ok)throw new Error("Signed webhook failed: HTTP "+first.status+" "+firstBody.slice(0,200));
const second=await post();
if(!second.ok)throw new Error("Webhook duplicate POST failed: HTTP "+second.status);
const webhook=await query<{n:string}>("SELECT count(*)::text AS n FROM whatsapp_webhook_events WHERE organization_id=$1 AND provider_event_id LIKE $2",[account.organization_id,(account.business_account_id??"qa-business")+":messages:%"]);
const messages=await query<{n:string}>("SELECT count(*)::text AS n FROM whatsapp_messages WHERE organization_id=$1 AND provider_message_id LIKE $2",[account.organization_id,marker+"%"]);
console.log(JSON.stringify({testType:"locally_signed_webhook_fixture_NOT_Meta_delivery",invalidSignatureStatus:fake.status,signedRequestStatus:first.status,replayedRequestStatus:second.status,persistedTestMessageRows:Number(messages.rows[0]?.n??0),signedBodyAccepted:true,providerEventIdentity:marker,webhookEventCountForBusiness:Number(webhook.rows[0]?.n??0)}));
