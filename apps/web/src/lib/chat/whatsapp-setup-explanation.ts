import type {WhatsAppReadiness} from '@ai-comms-agent/shared';
import {containsUnverifiedOperationClaim} from './operation-feedback';
import {userFacingChatAnswer} from './user-facing-answer';

/** The model explains verified checks; it cannot create controls or execute
 * actions. Provider failure leaves a factual, usable card available. */
export async function explainWhatsAppSetup(readiness:WhatsAppReadiness|null,generate:(facts:string)=>Promise<string>){
 const fallback=readiness?`${readiness.message} Use the controls below to continue here in Chat.`:'I couldn’t finish the connection check. Your details can still be reviewed here; choose Check again to retry.';
 try{
  const facts=JSON.stringify({state:readiness?.state??'unavailable',connected:readiness?.connected??null,canRequestSend:readiness?.canRequestSend??false,windowOpen:readiness?.windowOpen??null,explanation:readiness?.message??null});
  const text=await generate(facts);
  if(text.length>1200||containsUnverifiedOperationClaim(text))return fallback;
  return userFacingChatAnswer(text)||fallback;
 }catch{return fallback;}
}
