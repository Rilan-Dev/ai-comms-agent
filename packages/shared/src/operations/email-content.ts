export type EmailBodyReview = {kind:'exact';body:string} | {kind:'review_required';proposedBody:string};

/** Only explicit Body: sections are literal content. Quoting/fencing provides
 * a reliable boundary; ambiguous prose requires review rather than removing
 * words that might intentionally belong in the message. */
export function reviewExplicitEmailBody(message:string):EmailBodyReview|undefined {
  const markers=[...message.matchAll(/\bbody\s*:/gi)];
  if(!markers.length)return undefined;
  const marker=markers[0]!;
  const tail=message.slice(marker.index!+marker[0].length).replace(/^\s+/, '');
  const fenced=/^```(?:text|plaintext)?\r?\n([\s\S]*?)```/.exec(tail);
  if(fenced)return /\bbody\s*:/i.test(tail.slice(fenced[0].length))?{kind:'review_required',proposedBody:tail}:{kind:'exact',body:fenced[1]!};
  const quoted=/^"(?:\\.|[^"\\])*"/.exec(tail)?.[0];
  if(quoted){
    if(/\bbody\s*:/i.test(tail.slice(quoted.length)))return {kind:'review_required',proposedBody:tail};
    try{return {kind:'exact',body:JSON.parse(quoted) as string};}
    catch{return {kind:'exact',body:quoted.slice(1,-1)};}
  }
  // No trustworthy closing delimiter: ask for a quoted/fenced body even
  // when no recognizable operating instruction is present.
  return {kind:'review_required',proposedBody:tail};
}
