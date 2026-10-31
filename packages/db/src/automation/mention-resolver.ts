import {query} from "../client";

/**
 * Expand only explicitly selected @mention tokens. Each token is resolved from
 * current organization/account/owner records. Fail closed for removed or
 * malformed tokens, so schedules cannot silently fall back to the wrong phone.
 * This grants no tool capability and does not bypass sending approvals.
 */
export type MentionScope={organizationId:string;userId:string|null;text:string};
const tokenPattern=/@(email|whatsapp-from|whatsapp-to):([^\s,;]+)/g;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const email=/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const phone=/^\+[1-9][0-9]{7,14}$/;
export async function expandAuthorizedMentions(scope:MentionScope):Promise<string>{
 const text=scope.text;
 const tokens=[...text.matchAll(tokenPattern)];
 if(tokens.length===0)return text;
 if(tokens.length>15)throw new Error("Use at most 15 account or recipient mentions per instruction.");
 if(!scope.userId)throw new Error("A signed-in schedule owner is required to resolve saved account and recipient mentions.");
 const membership=await query<{id:string}>(
  "SELECT user_id::text AS id FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='active' LIMIT 1",
  [scope.organizationId,scope.userId],
 );
 if(!membership.rows[0])throw new Error("The account/recipient reference owner no longer has an active organization membership.");
 let result="";let previous=0;
 for(const token of tokens){
  const [whole,kind,value]=token;
  if(!whole||!kind||!value||token.index===undefined)continue;
  result+=text.slice(previous,token.index);
  let replacement:string;
  if(kind==="email"){
   if(!email.test(value))throw new Error("Invalid @email account mention. Re-select the connected account.");
   const record=await query<{address:string}>("SELECT email_address::text AS address FROM email_accounts WHERE organization_id=$1 AND lower(email_address::text)=lower($2) AND deleted_at IS NULL LIMIT 1",[scope.organizationId,value]);
   if(!record.rows[0])throw new Error("The mentioned email account is no longer connected to this organization.");
   replacement="email account "+record.rows[0].address;
  }else if(kind==="whatsapp-from"){
   if(!uuid.test(value))throw new Error("Invalid WhatsApp sender reference. Re-select the connected account.");
   const record=await query<{name:string|null;number:string|null}>(
    "SELECT display_name AS name,phone_number::text AS number FROM whatsapp_accounts WHERE organization_id=$1 AND id=$2 AND deleted_at IS NULL AND status='connected' LIMIT 1",
    [scope.organizationId,value]);
   if(!record.rows[0])throw new Error("The mentioned WhatsApp sending account is unavailable or disconnected.");
   replacement="connected WhatsApp sending account "+(record.rows[0].name||record.rows[0].number||value)+" (account ID "+value+")";
  }else{
   if(!phone.test(value))throw new Error("Invalid WhatsApp contact mention. Choose a saved contact.");
   const record=await query<{name:string;role:string;number:string}>(
    "SELECT display_name AS name,recipient_role AS role,phone_e164 AS number FROM personal_whatsapp_recipients WHERE organization_id=$1 AND owner_user_id=$2 AND phone_e164=$3 AND deleted_at IS NULL LIMIT 1",
    [scope.organizationId,scope.userId,value]);
   if(!record.rows[0])throw new Error("WhatsApp recipient is no longer saved in your personal contact directory.");
   replacement="WhatsApp recipient "+record.rows[0].name+" ("+record.rows[0].number+"), "+record.rows[0].role+" saved contact (ownership not independently verified)";
  }
  result+=replacement;previous=token.index+whole.length;
 }
 return result+text.slice(previous);
}
