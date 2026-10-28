const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A UI hint only: the server rechecks the checkpoint, sources and permissions. */
export function continuationForSavedMessage(message:{id:string;role?:string;contentJson?:unknown},userId:string,agentId:string,now:number):string|null{
 const value=message.contentJson;
 if(message.role!=='assistant'||!value||typeof value!=='object'||Array.isArray(value)||!uuid.test(message.id))return null;
 const checkpoint=value as Record<string,unknown>;
 if(checkpoint.kind!=='mail_whatsapp_review'||checkpoint.version!==1||checkpoint.creatorId!==userId||checkpoint.agentId!==agentId||checkpoint.operation!=null||typeof checkpoint.expiresAt!=='string')return null;
 const expiresAt=Date.parse(checkpoint.expiresAt);
 return Number.isFinite(expiresAt)&&expiresAt>now?message.id:null;
}
export function continuationForTurn(value:unknown):string|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const task=value as Record<string,unknown>;
 return task.operation==null&&task.needsRefresh===false&&typeof task.checkpointRef==='string'&&uuid.test(task.checkpointRef)?task.checkpointRef:null;
}
