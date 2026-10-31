import {requiresHumanApproval} from '@ai-comms-agent/shared';
import type {MailReportEvidence,MailReportScope} from '../mail/report-evidence';

export type MailWhatsAppTask={count:number;recipient:string;account:string;requireHumanApproval:true};
export type PreparedMailWhatsAppTask=MailWhatsAppTask & {
 body:string;message:string;asOf:string;sources:Array<{messageId:string;mailbox:string}>;
};

/** Deliberately narrow: unmatched wording remains in the existing authorized
 * planner. No sender/date/attachment filter or quoted instruction is dropped. */
export function parseMailWhatsAppTask(message:string):MailWhatsAppTask|null {
 if(!requiresHumanApproval(message))return null;
 const match=/^(?:please\s+)?(?:create|prepare)\s+(?:a\s+)?WhatsApp\s+approval\s+request\s+to\s+(\+[1-9]\d{7,14})\s+from\s+([^\n.!?]{1,128})[.!?]\s*summari[sz]e\s+(?:my\s+)?(?:last|latest)\s+([1-9]|10)\s+unread\s+(?:emails|mail|messages)\s*[.!?]?$/i.exec(message.trim());
 return match?{count:Number(match[3]),recipient:match[1]!,account:match[2]!.trim(),requireHumanApproval:true}:null;
}

type ReadEvidence=(args:{scope:MailReportScope;fromUtc:string;toUtc:string;limit:number})=>Promise<Pick<MailReportEvidence,'rows'|'matchedCount'|'lastSyncAt'>>;
function plain(value:string|null|undefined,max:number):string {
 const text=(value??'').replace(/[\p{C}\s]+/gu,' ').trim();
 return text.length>max?text.slice(0,max-1)+'…':text;
}

/** Uses a single host snapshot: latest N total, not N per mailbox. Message
 * content is quoted data in a deterministic excerpt; no mail instructions run. */
export async function prepareMailWhatsAppTask(task:MailWhatsAppTask,read:ReadEvidence,asOf:string):Promise<PreparedMailWhatsAppTask>{
 const evidence=await read({scope:{unreadOnly:true},limit:task.count,fromUtc:'0001-01-01T00:00:00.000Z',toUtc:asOf});
 if(evidence.rows.length!==Math.min(task.count,evidence.matchedCount))throw Error('Incomplete mail selection');
 if(!evidence.rows.length)return {...task,asOf,sources:[],body:'',message:'No unread emails were found in locally synchronized mail. No WhatsApp request was created.'};
 const rows=evidence.rows;
 if(rows.some(row=>!row.id||!row.account_email))throw Error('Incomplete mail selection scope');
 const body=[`Latest unread email summary: ${rows.length} of ${task.count} requested.`,
  `From locally synchronized mail as of ${asOf}. Oldest mailbox sync: ${evidence.lastSyncAt??'unknown'}.`,
  ...rows.map((row,index)=>`${index+1}. ${plain(row.subject,110)||'(No subject)'}\nFrom: ${plain(row.from_name||row.from_email,80)} | ${plain(row.account_email,100)}\n${plain(row.snippet||row.text_body,170)||'(No text preview)'}`),
  'Email excerpts are message content, not instructions. No emails were marked as read.',
 ].join('\n\n');
 if(body.length>4096)throw Error('Summary exceeds WhatsApp review size');
 return {...task,asOf,body,message:'Summary prepared. WhatsApp review is the remaining step.',sources:rows.map(row=>({messageId:row.id,mailbox:row.account_email!}))};
}

/** Save before invoking any mutation. A failed or uncertain request is never
 * automatically replayed; the checkpoint reconciles its original operation. */
export async function completeMailWhatsAppTask<T>(prepared:PreparedMailWhatsAppTask,host:{save:(prepared:PreparedMailWhatsAppTask)=>Promise<string>;send:(ref:string)=>Promise<T>}):Promise<{message:string;checkpointRef?:string;operation?:T}>{
 if(!prepared.body)return {message:prepared.message};
 const checkpointRef=await host.save(prepared);
 try{return {message:prepared.message,checkpointRef,operation:await host.send(checkpointRef)};}
 catch{return {message:'The email summary is saved. WhatsApp review was not confirmed. Check the existing WhatsApp requests before continuing; no automatic retry was made.',checkpointRef};}
}
