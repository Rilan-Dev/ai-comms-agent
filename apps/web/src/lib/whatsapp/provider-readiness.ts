import {loadWhatsAppCredential,parseCredentialsMasterKey} from '@ai-comms-agent/db';

type ProviderReadiness={state:'connected'|'provider_error'|'unavailable';checkedAt:number};
const cache=new Map<string,ProviderReadiness>();

/** Read-only Meta verification. Cache contains no credentials or provider
 * payloads and is scoped to the account's persisted revision for 30 seconds.
 * This is explanatory and never authorizes sending. */
export async function getWhatsAppProviderReadiness(account:{id:string;organizationId:string;phoneNumberId:string;revision:string}):Promise<ProviderReadiness>{
 const key=JSON.stringify(account),cached=cache.get(key);
 if(cached&&Date.now()-cached.checkedAt<30000)return cached;
 let state:ProviderReadiness['state']='unavailable';
 try{
  const keyValue=process.env.CREDENTIALS_MASTER_KEY;
  if(!keyValue)return {state:'provider_error',checkedAt:Date.now()};
  const credential=await loadWhatsAppCredential(account.id,account.organizationId,parseCredentialsMasterKey(keyValue));
  if(typeof credential?.access_token!=='string'||!credential.access_token)return {state:'provider_error',checkedAt:Date.now()};
  const url=new URL((process.env.WHATSAPP_GRAPH_API_VERSION||'v23.0')+'/'+encodeURIComponent(account.phoneNumberId),'https://graph.facebook.com/');url.searchParams.set('fields','id');
  const response=await fetch(url,{headers:{authorization:'Bearer '+credential.access_token},cache:'no-store',signal:AbortSignal.timeout(5000)});
  const result=await response.json().catch(()=>({})) as {id?:unknown};
  state=response.ok&&result.id===account.phoneNumberId?'connected':response.status===429||response.status>=500?'unavailable':'provider_error';
 }catch{state='unavailable';}
 const result={state,checkedAt:Date.now()};
 if(cache.size>=128)cache.delete(cache.keys().next().value!);
 cache.set(key,result);return result;
}
