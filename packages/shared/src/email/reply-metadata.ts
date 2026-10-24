/** Validated RFC threading fields, sourced from persisted tenant-scoped mail. */
export function replyMessageId(value: unknown): string {
  if(typeof value!=='string'||value.length>998||/[\r\n]/.test(value))throw Error('A valid original email Message-ID is required');
  const id=value.trim().replace(/^<|>$/g,'');
  if(!id||/[\s<>]/.test(id)||!id.includes('@'))throw Error('A valid original email Message-ID is required');
  return `<${id}>`;
}
export function replyReferences(value: unknown, parent: string): string {
  const text=typeof value==='string'?value:'';
  if(/[\r\n]/.test(text)||text.length>16000)throw Error('Invalid email References header');
  const ids=text.trim()?text.trim().split(/\s+/).map(replyMessageId):[];
  return [...new Set([...ids,replyMessageId(parent)])].join(' ');
}
export function emailReplyMetadata(row: Record<string,unknown>): {inReplyTo?:string;referencesHeader?:string;providerThreadId?:string} {
  if(row.in_reply_to==null||row.in_reply_to==='')return {};
  const inReplyTo=replyMessageId(row.in_reply_to);
  const referencesHeader=replyReferences(row.references_header,inReplyTo);
  const thread=row.reply_provider_thread_id;
  if(thread!=null&&(typeof thread!=='string'||!thread||thread.length>998||/[\r\n\u0000]/.test(thread)))throw Error('Invalid email provider thread');
  return {inReplyTo,referencesHeader,...(typeof thread==='string'?{providerThreadId:thread}:{})};
}
