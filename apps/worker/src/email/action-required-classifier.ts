/**
 * Conservative first-pass triage of provider-synced inbound mail.
 * "Email action required" must not remain permanently false just because
 * providers do not supply that opinion as an email flag. This is explicitly
 * a deterministic signal, NOT an LLM assessment or authorization to send.
 * It is intended to minimize false positives, not catch every possible ask.
 */
export type ActionRequiredCandidate={
 subject:string;snippet:string;body:string;from:string;to:string[];
 accountEmail:string;isDraft:boolean;isOutbound:boolean;
};
const requestSubject=/(?:^|[:\-\[\(]\s*)(?:action required|your action (?:required|needed)|approval (?:required|requested|needed)|response (?:required|needed)|please (?:reply|respond|review|approve|confirm|sign|complete)|request for (?:approval|confirmation|response)|signature (?:required|requested)|payment approval (?:required|requested))\b/i;
const directRequest=/(?:^|[.!?\n]\s*|\b)(?:could you|can you|would you|please|we (?:need|require) you to|your approval is required to)\s+(?:(?:kindly|please)\s+)?(?:review|approve|confirm|reply|respond|sign|complete|provide|send|share|submit|verify|authorize)\b/i;
const bulkSubject=/(?:newsletter|weekly digest|daily digest|promotion|sale|discount|marketing|unsubscribe|auto-?reply|out of office|delivery status notification|undeliverable|do not reply|receipt)\b/i;
const bulkAddress=/(?:^|[<\s])(?:no[.-]?reply|donotreply|newsletter|marketing|mailer-daemon|postmaster)@/i;
function actualAddress(value:string){const m=value.match(/<([^<>]+)>/);return (m?.[1]??value).trim().toLowerCase();}
export function isLikelyActionRequiredEmail(m:ActionRequiredCandidate):boolean {
 if(m.isDraft||m.isOutbound||!m.accountEmail||!m.from)return false;
 const from=actualAddress(m.from),me=actualAddress(m.accountEmail);
 if(from===me||bulkAddress.test(from)||bulkSubject.test(m.subject))return false;
 const directRecipient=m.to.some(item=>actualAddress(item)===me);
 if(!directRecipient)return false;
 // High precision subject signals, or a specific, explicit request in body.
 const subject=m.subject.slice(0,300);
 if(requestSubject.test(subject))return true;
 const sample=(m.snippet||m.body).slice(0,1000);
 return directRequest.test(sample) && !/unsubscribe|opt out|preferences center/i.test(sample);
}
