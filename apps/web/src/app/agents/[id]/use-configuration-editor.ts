"use client";

import {useCallback,useEffect,useRef,useState} from 'react';
import type {AgentConfigurationSnapshotV1,ConfigurationDiff} from '@ai-comms-agent/shared';
import {configurationEditorUrl,saveConfigurationForm,sendConfigurationCommand,type ConfigurationFormPatch} from '@/lib/agents/configuration-editor-client';

type Revision={id:string;revisionNumber:number;snapshot:AgentConfigurationSnapshotV1;coverage:string};
export type ConfigurationEditorView={active:Revision;draft:Revision|null;requiredRevocations:string[];canApply:boolean;canEditAi:boolean};
export type ConfigurationEditorReview={id:string;revisionId:string;baseRevisionId:string;diff:ConfigurationDiff;expiresAt:string};

export function useConfigurationEditor(organizationId:string,agentId:string,enabled:boolean){
 const [view,setView]=useState<ConfigurationEditorView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [review,setReview]=useState<ConfigurationEditorReview|null>(null),[dirty,setDirty]=useState<string[]>([]);
 const locked=useRef(false),mounted=useRef(true);
 const target={organizationId,agentId};
 const reload=useCallback(async()=>{
  const response=await fetch(configurationEditorUrl({organizationId,agentId}),{cache:'no-store'});
  const body=await response.json();if(!response.ok)throw Error(body.message??'Saved configuration could not load. Your form choices remain here.');
  if(mounted.current){setView(body as ConfigurationEditorView);setReview(null);}return body as ConfigurationEditorView;
 },[organizationId,agentId]);
 useEffect(()=>{mounted.current=true;if(enabled)void reload().catch(reason=>{if(mounted.current)setError(reason instanceof Error?reason.message:'Saved configuration unavailable.');});return()=>{mounted.current=false;};},[enabled,reload]);
 useEffect(()=>{if(!enabled||!dirty.length)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[enabled,dirty.length]);
 function markDirty(section:string,value=true){setDirty(current=>value?[...new Set([...current,section])]:current.filter(key=>key!==section));setReview(null);}
 async function exclusive<T>(action:()=>Promise<T>):Promise<T>{
  if(locked.current)throw Error('Wait for the current change to finish.');locked.current=true;setBusy(true);setError('');
  try{return await action();}catch(reason){setError(reason instanceof Error?reason.message:'The change could not be confirmed.');throw reason;}finally{locked.current=false;setBusy(false);}
 }
 async function save(section:string,patch:ConfigurationFormPatch){
  return exclusive(async()=>{
   const result=await saveConfigurationForm(target,view?{activeRevisionId:view.active.id,draftRevisionId:view.draft?.id??null}:null,patch);
   setReview(null);markDirty(section,false);
   // Preserve the confirmed save even if the follow-up status read fails.
   setView(current=>current?{...current,draft:result.draft.id===current.active.id?null:result.draft}:current);
   await reload().catch(()=>setError('Draft saved. Reload its status before reviewing; your active settings have not changed.'));
   return result;
  });
 }
 async function requestReview(acceptedCustomFields:string[]=[],acknowledgedRevocations:string[]=[]){
  if(!view?.draft)throw Error('Save a draft first.');if(dirty.length)throw Error('Save or cancel the remaining form edits before review.');
  return exclusive(async()=>{const result=await sendConfigurationCommand(target,{command:'review',revisionId:view.draft!.id,acceptedCustomFields,acknowledgedRevocations});setReview(result.review);return result.review as ConfigurationEditorReview;});
 }
 async function apply(){
  if(!view?.draft||!review||dirty.length||review.revisionId!==view.draft.id||review.baseRevisionId!==view.active.id)throw Error('Review the saved changes before applying.');
  return exclusive(async()=>{await sendConfigurationCommand(target,{command:'apply',revisionId:review.revisionId,activeRevisionId:review.baseRevisionId,reviewId:review.id,environment:'production'});window.location.reload();});
 }
 async function revoke(changes:Record<string,unknown>){
  if(!view)throw Error('Wait for the saved configuration to load.');
  return exclusive(async()=>{const result=await sendConfigurationCommand(target,{command:'revoke',activeRevisionId:view.active.id,changes});setReview(null);await reload().catch(()=>setError('Access removal was confirmed. Reload saved status before making another change.'));return result;});
 }
 return {enabled,view,busy,error,review,dirty,markDirty,save,reload,requestReview,apply,revoke};
}
export type ConfigurationEditor=ReturnType<typeof useConfigurationEditor>;
