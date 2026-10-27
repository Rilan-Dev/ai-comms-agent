import {reviewExplicitEmailBody} from '@ai-comms-agent/shared';

export function latestSenderReplyAddress(message:string):string|null{
  if(!draftPlanningContext([],message).independentCompose)return null;
  return /\breply\s+to\s+(?:the\s+)?(?:last|latest|newest)\s+(?:incoming\s+)?e-?mail\s+from\s+([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i.exec(message)?.[1]??null;
}

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
  // "Latest from <address>" identifies a new lookup, not a reference to the
  // last assistant answer. Old mailbox IDs and failed requests must not become
  // its source. Keep the full current text and normal discovery/authorization.
  const latestSenderMatch=new RegExp('^(?:(?:please|kindly)\\s+)?(?:(?:draft|write|prepare|compose)\\s+(?:(?:a|an|short|brief)\\s+){0,3})?reply\\s+to\\s+(?:the\\s+)?(?:last|latest|newest)\\s+(?:incoming\\s+)?e-?mail\\s+from\\s+'+address+'(?=[\\s.,;!]|$)','i').exec(headers);
  // Recognize only the small complete-request grammar, rather than guessing
  // that every unrecognized suffix is independent of earlier wording.
  const independentSuffix=latestSenderMatch?headers.slice(latestSenderMatch[0].length)
    .replace(/\bin\s+(?:its|the)\s+original\s+thread\b/gi,'')
    .replace(/\bthis\s+is\s+a\s+qa\s+reply\s+test\b/gi,'')
    .replace(/\bdo\s+not\s+send(?:\s+it)?(?:\s+or\s+request\s+sending)?\b/gi,''):null;
  const latestSenderReply=independentSuffix!==null&&/^[\s.,;!]*$/.test(independentSuffix)&&bodyAt<0;
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
  const independent=complete||latestSenderReply;
  return {history:independent?[]:history,independentCompose:independent};
}
