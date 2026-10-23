"use client";
import {useEffect,useState} from 'react';
import {deriveWhatsAppReadiness,type WhatsAppReadiness} from '@ai-comms-agent/shared';

export function useWhatsAppReadiness(args:{organizationId:string;agentId?:string;accountId?:string;recipient?:string;revision?:string}){
 const scopeKey=JSON.stringify([args.organizationId,args.agentId,args.accountId,args.recipient,args.revision]);
 const loading=deriveWhatsAppReadiness({loaded:false,account:null,canSend:false,toolEnabled:false,windowOpen:null});
 const [snapshot,setSnapshot]=useState<{scopeKey:string;value:WhatsAppReadiness}>(()=>({scopeKey:'',value:loading}));
 useEffect(()=>{
  let cancelled=false;
  const controller=new AbortController();
  const setReadiness=(value:WhatsAppReadiness)=>setSnapshot({scopeKey,value});
  setReadiness(deriveWhatsAppReadiness({loaded:false,account:null,canSend:false,toolEnabled:false,windowOpen:null}));
  if(!args.agentId&&!args.accountId)return()=>{cancelled=true;controller.abort();};
  const timer=setTimeout(()=>{
   const parameters=new URLSearchParams({organizationId:args.organizationId});
   if(args.agentId)parameters.set('agentId',args.agentId);
   if(args.accountId)parameters.set('accountId',args.accountId);
   if(args.recipient&&/^\+[1-9]\d{7,14}$/.test(args.recipient))parameters.set('recipient',args.recipient);
   void fetch('/api/whatsapp/readiness?'+parameters,{cache:'no-store',signal:controller.signal}).then(async response=>{
    if(!response.ok)throw new Error('readiness_unavailable');
    const result=await response.json() as WhatsAppReadiness;
    if(!cancelled)setReadiness(result);
   }).catch(()=>{if(!cancelled)setReadiness(deriveWhatsAppReadiness({loaded:true,error:true,account:null,canSend:false,toolEnabled:false,windowOpen:null}));});
  },200);
  return()=>{cancelled=true;clearTimeout(timer);controller.abort();};
 },[args.organizationId,args.agentId,args.accountId,args.recipient,args.revision,scopeKey]);
 if(!args.agentId&&!args.accountId)return {...loading,state:'disconnected' as const,message:'Select a connected WhatsApp account.'};
 return snapshot.scopeKey===scopeKey?snapshot.value:loading;
}
