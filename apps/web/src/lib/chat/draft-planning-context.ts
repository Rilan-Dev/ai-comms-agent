import {reviewExplicitEmailBody} from '@ai-comms-agent/shared';

/** Complete new compose fields belong to the current request. Old transcript
 * failures or unrelated actions are not part of this new draft's authority.
 * Reference-dependent follow-ups retain history and all normal tool checks. */
export function draftPlanningContext<T extends {role:string;content:string}>(history:T[],message:string):{history:T[];independentCompose:boolean}{
  const bodyAt=message.search(/\bbody\s*:/i);
  const headers=bodyAt<0?message:message.slice(0,bodyAt);
  const newDraft=/^(?:(?:please|kindly)\s+)?(?:create|write|compose|prepare)\s+(?:(?:a|an|new)\s+){0,3}(?:e-?mail\s+)?draft\b/i.test(headers);
  const address='[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}';
  const complete=newDraft
    && !/\b(?:previous|above|earlier|same|that|those|last)\b/i.test(headers)
    && new RegExp('\\bfrom\\s+'+address,'i').test(headers)
    && new RegExp('\\bto\\s+'+address,'i').test(headers)
    && /\bsubject\s*:\s*\S/i.test(headers)
    && reviewExplicitEmailBody(message)?.kind==='exact';
  return {history:complete?[]:history,independentCompose:complete};
}
