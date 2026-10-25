import type {AgentConfigurationSnapshotV1,AgentEmailAccountRole} from '@ai-comms-agent/shared';

export type ConfigurationDenials={tools:string[];emailRead:string[];emailSend:string[];whatsapp:string[];paused:boolean;autonomousSend:boolean};
export const emptyConfigurationDenials=():ConfigurationDenials=>({tools:[],emailRead:[],emailSend:[],whatsapp:[],paused:false,autonomousSend:false});
export function readConfigurationDenials(value:unknown):ConfigurationDenials{
 const row=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 return {tools:list(row.tools),emailRead:list(row.emailRead),emailSend:list(row.emailSend),whatsapp:list(row.whatsapp),paused:row.paused===true,autonomousSend:row.autonomousSend===true};
}
function list(value:unknown):string[]{return Array.isArray(value)?[...new Set(value.filter((item):item is string=>typeof item==='string'))].sort():[];}
export function emailRoleAccess(role:AgentEmailAccountRole|undefined):{read:boolean;send:boolean}{return {read:role==='primary'||role==='read_only',send:role==='primary'||role==='send_only'};}
export function configurationRevocations(before:AgentConfigurationSnapshotV1,after:AgentConfigurationSnapshotV1):ConfigurationDenials{
 const result=emptyConfigurationDenials();const afterTools=new Set(after.policy?.allowedTools??[]);
 result.tools=(before.policy?.allowedTools??[]).filter(tool=>!afterTools.has(tool));
 for(const binding of before.channels.email){const old=emailRoleAccess(binding.role),next=emailRoleAccess(after.channels.email.find(row=>row.accountId===binding.accountId)?.role);if(old.read&&!next.read)result.emailRead.push(binding.accountId);if(old.send&&!next.send)result.emailSend.push(binding.accountId);}
 if(before.channels.whatsappAccountId&&after.channels.whatsappAccountId!==before.channels.whatsappAccountId)result.whatsapp.push(before.channels.whatsappAccountId);
 result.paused=before.lifecycle.status==='active'&&after.lifecycle.status!=='active';
 result.autonomousSend=before.policy?.securityPolicy.autonomous_send===true&&after.policy?.securityPolicy.autonomous_send!==true;
 return result;
}
export function mergeConfigurationDenials(a:ConfigurationDenials,b:ConfigurationDenials):ConfigurationDenials{return {tools:list([...a.tools,...b.tools]),emailRead:list([...a.emailRead,...b.emailRead]),emailSend:list([...a.emailSend,...b.emailSend]),whatsapp:list([...a.whatsapp,...b.whatsapp]),paused:a.paused||b.paused,autonomousSend:a.autonomousSend||b.autonomousSend};}
export function requestedRevokedAccess(snapshot:AgentConfigurationSnapshotV1,barrier:ConfigurationDenials):string[]{
 const required:string[]=[];for(const tool of barrier.tools)if(snapshot.policy?.allowedTools.includes(tool))required.push(`tool:${tool}`);
 for(const binding of snapshot.channels.email){const access=emailRoleAccess(binding.role);if(access.read&&barrier.emailRead.includes(binding.accountId))required.push(`email.read:${binding.accountId}`);if(access.send&&barrier.emailSend.includes(binding.accountId))required.push(`email.send:${binding.accountId}`);}
 if(snapshot.channels.whatsappAccountId&&barrier.whatsapp.includes(snapshot.channels.whatsappAccountId))required.push(`whatsapp:${snapshot.channels.whatsappAccountId}`);
 if(barrier.paused&&snapshot.lifecycle.status==='active')required.push('lifecycle:resume');
 if(barrier.autonomousSend&&snapshot.policy?.securityPolicy.autonomous_send===true)required.push('sending:automatic');return required.sort();
}
export function acknowledgeConfigurationGrants(barrier:ConfigurationDenials,grants:readonly string[]):ConfigurationDenials{
 const allowed=new Set(grants);return {tools:barrier.tools.filter(tool=>!allowed.has(`tool:${tool}`)),emailRead:barrier.emailRead.filter(id=>!allowed.has(`email.read:${id}`)),emailSend:barrier.emailSend.filter(id=>!allowed.has(`email.send:${id}`)),whatsapp:barrier.whatsapp.filter(id=>!allowed.has(`whatsapp:${id}`)),paused:barrier.paused&&!allowed.has('lifecycle:resume'),autonomousSend:barrier.autonomousSend&&!allowed.has('sending:automatic')};
}
