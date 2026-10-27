import {listPendingBriefingWork,deferBriefingWork} from '@ai-comms-agent/db';
import type {TrustedBriefingPrincipal} from '@ai-comms-agent/shared';
import {processBriefingBatch} from './briefing-worker';
import {createCanonicalBriefingWorkerDependencies} from './generator';

type Work=TrustedBriefingPrincipal&{manifestId:string;language:string};
type Dependencies={list:()=>Promise<Work[]>;process:(item:Work)=>Promise<unknown>;failed:(item:Work)=>void|Promise<void>};
/** Existing immutable jobs are the queue. Authority is checked again by claim,
 * canonical loading and completion; email/model text supplies no principal. */
export async function dispatchBriefingWork(enabled:boolean,deps:Dependencies):Promise<void>{
  if(!enabled)return;
  for(const item of (await deps.list()).slice(0,2)){
    try{await deps.process(item);}catch{await deps.failed(item);}
  }
}

let running=false;
export async function processPendingBriefings():Promise<void>{
  if(running||process.env.BRIEFINGS_ENABLED!=='true')return;
  running=true;
  try{
    await dispatchBriefingWork(true,{
      list:listPendingBriefingWork,
      process:async item=>processBriefingBatch({organizationId:item.organizationId,userId:item.userId,agentId:item.agentId},
        item.manifestId,item.language,createCanonicalBriefingWorkerDependencies(item)),
      failed:async item=>{
        await deferBriefingWork(item);
        console.warn(JSON.stringify({service:'worker.briefings',message:'Briefing deferred; current access, source and provider checks will be retried',manifestId:item.manifestId}));
      },
    });
  }finally{running=false;}
}
