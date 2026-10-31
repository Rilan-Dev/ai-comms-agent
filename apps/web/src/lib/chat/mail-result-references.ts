export type ChatMailReference = {kind:'draft'|'approval';id:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Tool results supply identifiers only. All content and current status are
 * fetched again from the authenticated mail APIs before any action. */
export function chatMailReferences(value:unknown):ChatMailReference[]{
 if(!Array.isArray(value))return [];
 const found:ChatMailReference[]=[];const seen=new Set<string>();
 for(const item of value){
  const o=item && typeof item==='object' && !Array.isArray(item) ? (item as Record<string,unknown>).operation : null;
  if(!o||typeof o!=='object'||Array.isArray(o))continue;
  const op=o as Record<string,unknown>;
  if(op.channel!=='email'||typeof op.resourceId!=='string'||!uuid.test(op.resourceId)||!op.turnId||!op.callId||!op.correlationId)continue;
  const kind=op.state==='draft_saved'?'draft':op.state==='pending_approval'?'approval':null;
  const key=`${kind}:${op.resourceId}`;if(kind&&!seen.has(key)){seen.add(key);found.push({kind,id:op.resourceId});}
 }
 return found;
}
