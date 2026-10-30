/** Explicit schedule-level provider-failure fallback. Pure validation and formatting. */
export interface DigestFallback {
  mode: "deterministic_whatsapp_digest";
  lookbackHours: number;
  recipientPhone: string;
}
export function parseDigestFallback(input:unknown): {valid:true; value:DigestFallback|null}|{valid:false;reason:string}{
  if(input===undefined)return {valid:true,value:null};
  if(!input || typeof input!=="object" || Array.isArray(input))return {valid:false,reason:"Invalid scheduled digest fallback."};
  const obj=input as Record<string,unknown>;
  if(Object.keys(obj).some(k=>!["mode","lookbackHours","recipientPhone"].includes(k))||
    obj.mode!=="deterministic_whatsapp_digest"||
    !Number.isInteger(obj.lookbackHours)||(obj.lookbackHours as number)<1||(obj.lookbackHours as number)>720||
    typeof obj.recipientPhone!=="string"||! /^\+[1-9]\d{7,14}$/.test(obj.recipientPhone)){
    return {valid:false,reason:"Digest fallback requires an approved mode, lookbackHours (1-720), and E.164 recipient."};
  }
  return {valid:true,value:obj as unknown as DigestFallback};
}
export function isEligibleDigestProviderFailure(error:unknown):boolean{
  const message=error instanceof Error?error.message:String(error??"");
  return /(?:Gemini|Sarvam|OpenAI) tool request failed \((?:408|429|500|502|503|504)\)/i.test(message)||
    message.includes("The AI provider did not complete a tool response before the deadline.");
}
export type DigestResult={matched_count?:unknown;included_count?:unknown;has_more?:unknown;messages?:unknown};
type DigestMessage={subject?:unknown;from_address?:unknown;received_at?:unknown};
const privateSubject=/(?:password|otp|one.?time|verification code|2fa|recovery code|reset code|access token|security code)/i;
function safeHeader(value:unknown,max:number):string{
  if(typeof value!=="string")return "";
  return value.replace(/[\u0000-\u001F\u007F-\u009F]/g," ").replace(/\s+/g," ").trim().slice(0,max);
}
export function buildVerifiedDigest(inputs:Array<{mailbox:string;output:DigestResult}>,hours:number,now:Date):{
  body:string;total:number;coverageLimited:boolean;highlights:string[];
}{
  if(!inputs.length)throw new Error("No connected authorized mailbox was retrieved.");
  let total=0,coverageLimited=false;
  const subjects=new Map<string,{summary:string;score:number;recency:number}>();
  for(const {mailbox,output} of inputs){
    if(!Number.isSafeInteger(output.matched_count)||(output.matched_count as number)<0||!Array.isArray(output.messages))
      throw new Error("Email search did not provide verifiable counts and records.");
    total+=output.matched_count as number;
    coverageLimited ||= output.has_more===true;
    for(const raw of output.messages){
      if(!raw||typeof raw!=="object")continue;
      const m=raw as DigestMessage, subject=safeHeader(m.subject,100);
      if(!subject||privateSubject.test(subject))continue;
      const sender=safeHeader(m.from_address,60);
      const score=/(failed|payment|invoice|overdue|action required|urgent|deployment|security|contract|proposal|lead|prospect|research)/i.test(subject)?2:0;
      const parsed=typeof m.received_at==="string"?Date.parse(m.received_at):NaN;
      const recency=Number.isFinite(parsed)?parsed:0;
      const key=(mailbox+"::"+subject).toLowerCase(),old=subjects.get(key);
      if(!old||recency>old.recency)subjects.set(key,{summary:subject+(sender?" — "+sender:""),score,recency});
    }
  }
  const highlights=[...subjects.values()].sort((a,b)=>b.score-a.score||b.recency-a.recency).slice(0,5).map(x=>x.summary);
  const stamp=new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",dateStyle:"medium",timeStyle:"short"}).format(now);
  const body=[
    "📬 Scheduled unread email digest — "+stamp+" IST",
    "Window: last "+hours+" hours; locally synced unread messages: "+total+".",
    ...inputs.map(x=>safeHeader(x.mailbox,80)+": "+x.output.matched_count+" unread."),
    ...(highlights.length?["Key subjects:",...highlights.map(x=>"• "+x)]:["No unread subject highlights in this window."]),
    ...(coverageLimited?["Note: only a page of some mailbox results was inspected."]:[]),
    "Generated from authorized mailbox records without AI-provider content generation."
  ].join("\n");
  if(body.length>4096)throw new Error("Digest exceeds WhatsApp message length limit.");
  return {body,total,coverageLimited,highlights};
}
