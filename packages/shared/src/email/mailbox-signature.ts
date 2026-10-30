/** The saved signature is mailbox-owned data, never an LLM instruction. */
export const MAIL_SIGNATURE_MAX_LENGTH=4000;
export function normalizeMailboxSignature(raw:unknown):string{
 if(typeof raw!=="string")throw new Error("Mailbox signature must be text.");
 if(raw.length>MAIL_SIGNATURE_MAX_LENGTH)throw new Error("Mailbox signature cannot exceed 4000 characters.");
 const clean=raw.replace(/\r\n?/g,"\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"");
 return clean.trim()?clean:"";
}
export function applyMailboxSignature(body:string,signature:unknown):string{
 if(typeof signature!=="string"||!signature.trim())return body;
 const saved=normalizeMailboxSignature(signature);
 if(!saved||body.trimEnd().endsWith(saved.trimEnd()))return body;
 // Replace ordinary generated closings; leave the user's substantive message intact.
 const stripped=body.trimEnd().replace(/(?:\n\s*)+(?:Best regards|Kind regards|Warm regards|Regards|Sincerely|Best wishes|Thanks|Thank you),?(?:\s*\n\s*[A-Za-z][A-Za-z .'-]{0,100})?\s*$/i,"").trimEnd();
 return (stripped?stripped+"\n\n":"")+saved;
}
