import {reviewExplicitEmailBody} from '@ai-comms-agent/shared';

/** Complete new compose fields belong to the current request. Old transcript
 * failures or unrelated actions are not part of this new draft's authority.
 * Reference-dependent follow-ups retain history and all normal tool checks. */
export function draftPlanningContext<T extends {role:string;content:string}>(history:T[],message:string):{history:T[];independentCompose:boolean}{
  const bodyAt=message.search(/\bbody\s*:/i);
  const headers=bodyAt<0?message:message.slice(0,bodyAt);
  const newDraft=/^(?:(?:please|kindly)\s+)?(?:create|write|compose|prepare)\s+(?:(?:a|an|new)\s+){0,3}(?:e-?mail\s+)?draft\b/i.test(headers);
  const replyDraft=/^(?:(?:please|kindly)\s+)?(?:create|save|write|compose|prepare)\s+(?:(?:a|an|new)\s+){0,3}reply\s+draft\b/i.test(headers);
  const address='[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}';
  const references=headers.replace(/"(?:\\.|[^"\\])*"/g,' ');
  const identifiedSource=/\b(?:message|message_id|message id)\s*:?\s*[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/i.test(references)
    || (/\b(?:titled|subject\s*:)\s*"[^"\r\n]+"/i.test(headers)&&new RegExp('\\bfrom\\s+'+address,'i').test(headers));
  const completeReply=replyDraft&&identifiedSource&&new RegExp('\\bin\\s+(?:my\\s+)?'+address,'i').test(headers);
  const completeNew=newDraft
    && new RegExp('\\bfrom\\s+'+address,'i').test(headers)
    && new RegExp('\\bto\\s+'+address,'i').test(headers)
    && /\bsubject\s*:\s*\S/i.test(headers);
  const complete=(completeNew||completeReply)
    && !/\b(?:previous|above|earlier|same|that|those|last)\b/i.test(references)
    && reviewExplicitEmailBody(message)?.kind==='exact';
  return {history:complete?[]:history,independentCompose:complete};
}
