/**
 * Source-bound fallback for read-only event summaries when the requested
 * model fails or returns no output. This never triggers provider sends or
 * creates drafts and it is labelled as a non-AI recap in run history.
 */
type AgentInput={source:string;intent:string;params:Record<string,unknown>};
function value(v:unknown,limit=320):string {
 return typeof v==="string" ? v.replace(/[\x00-\x1f\x7f]/g," ").replace(/\s+/g," ").trim().slice(0,limit):"";
}
export function summaryOnlyAutomation(input:AgentInput):boolean {
 const a=input.params.actions;
 const ev=input.params.event;
 return input.source==="automation"&&input.intent==="automation.execute"
   &&Array.isArray(a)&&a.length===1&&a[0]&&typeof a[0]==="object"&&a[0].type==="generate_summary"
   &&ev!==null&&typeof ev==="object"&&!Array.isArray(ev);
}
export function sourceSummaryFallback(input:AgentInput,reason:"empty"|"provider_error"):string|null {
 if(!summaryOnlyAutomation(input))return null;
 const e=input.params.event as Record<string,unknown>;
 // Trusted event type is supplied separately; require a known provider field
 // rather than turning arbitrary empty payloads into successful messages.
 if(!["email","whatsapp"].some(t=>Object.keys(e).some(k=>k.toLowerCase().includes(t)))
   && !["from","subject","body","messageType","emailAccountId","accountId"].some(k=>k in e))return null;
 const isEmail=Boolean(e.emailAccountId)||Boolean(e.subject)||Boolean(e.from);
 const lines=[
  "Source-field recap (AI model unavailable — NOT an AI-generated summary).",
  "This automation read event metadata only. No email or WhatsApp was sent.",
  ...(isEmail?[
    "Channel: Email"+(e.actionRequired===true?" (flagged action required)":""),
    ...(value(e.from,180)?["From: "+value(e.from,180)]:[]),
    ...(value(e.subject,240)?["Subject: "+value(e.subject,240)]:[]),
    ...(value(e.snippet,600)?["Message preview: "+value(e.snippet,600)]:[]),
  ]:[
    "Channel: WhatsApp",
    ...(value(e.messageType,70)?["Message type: "+value(e.messageType,70)]:[]),
    ...(value(e.body,600)?["Message preview: "+value(e.body,600)]:[]),
  ]),
  "AI status: "+(reason==="empty"?"Model returned an empty answer.":"Provider unavailable or rate-limited."),
 ];
 if(!isEmail && !value(e.messageType) && !value(e.body))return null;
 return lines.join("\n");
}
export function recoverableSummaryProviderError(error:unknown):boolean {
 const message=error instanceof Error?error.message:String(error);
 return /\b429\b|quota|rate.limit|temporarily unavailable|timed? ?out|streamed a completion with no content|no visible content|provider.*empty|provider.*unavailable/i.test(message);
}
