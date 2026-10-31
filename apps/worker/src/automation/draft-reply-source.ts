/**
 * Extract the validated source of an incoming email for reply drafts.
 * createLocalDraft revalidates that this message belongs to the same
 * organization and mailbox before it links the existing thread.
 */
export function draftReplySourceFromEvent(event:Record<string,unknown>):
 {recipient:string;replyToMessageId:string|null}|null {
 const original=typeof event.from==="string"?event.from.trim():"";
 const bracket=original.match(/<([^<>\s]+@[^<>\s]+)>/);
 const recipient=(bracket?.[1]??original).trim();
 if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))return null;
 const sourceId=typeof event.messageId==="string"?event.messageId.trim():"";
 const replyToMessageId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sourceId)?sourceId:null;
 return {recipient,replyToMessageId};
}
