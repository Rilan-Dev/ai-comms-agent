import type {AgentConfigurationSnapshotV1,AgentEmailAccountRole} from '@ai-comms-agent/shared';
type Channels=AgentConfigurationSnapshotV1['channels'];
export function assignConfigurationChannels(current:Channels,selection:{emailAccountId?:string;emailRole?:AgentEmailAccountRole;whatsappAccountId?:string}):Channels{
 const email=current.email.filter(binding=>!selection.emailAccountId||binding.accountId!==selection.emailAccountId).map(binding=>({...binding}));
 if(selection.emailAccountId){if(!selection.emailRole)throw Error('Choose a mailbox role.');email.push({accountId:selection.emailAccountId,role:selection.emailRole});}
 return {email,whatsappAccountId:selection.whatsappAccountId||current.whatsappAccountId};
}
type Removal={emailAccountId:string;whatsappAccountId?:never}|{whatsappAccountId:string;emailAccountId?:never};
type Plan={kind:'draft';channels:Channels}|{kind:'revoke';changes:{email:Array<{accountId:string;access:'all'}>}|{whatsappAccountId:string}};
export function planConfigurationChannelRemoval(active:Channels,candidate:Channels,target:Removal):Plan{
 if(target.emailAccountId){
  if(active.email.some(binding=>binding.accountId===target.emailAccountId))return {kind:'revoke',changes:{email:[{accountId:target.emailAccountId,access:'all'}]}};
  return {kind:'draft',channels:{...candidate,email:candidate.email.filter(binding=>binding.accountId!==target.emailAccountId)}};
 }
 if(active.whatsappAccountId===target.whatsappAccountId)return {kind:'revoke',changes:{whatsappAccountId:target.whatsappAccountId!}};
 return {kind:'draft',channels:{...candidate,whatsappAccountId:active.whatsappAccountId}};
}
