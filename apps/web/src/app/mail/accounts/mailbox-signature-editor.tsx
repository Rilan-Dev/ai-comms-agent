"use client";
export function MailboxSignatureEditor({value,onChange,id,label="Email signature"}:{
 value:string;onChange:(next:string)=>void;id:string;label?:string;
}){
 const insert=(valueToInsert:string)=>onChange((value+valueToInsert).slice(0,4000));
 return <div className="space-y-2 rounded-md border bg-muted/20 p-3">
  <label htmlFor={id} className="block text-sm font-semibold">{label} (optional)</label>
  <p className="text-xs text-muted-foreground">Your saved signature belongs to this sending mailbox, not your profile. It is appended verbatim to new drafts and replies. Leave blank to let the agent compose its own closing.</p>
  <div className="flex flex-wrap gap-2">
    <button type="button" title="Insert a closing. Enter your own name and company." onClick={()=>insert((value?"\n":"")+"Best regards,\n")} className="rounded-md border px-2 py-1 text-xs">+ Closing</button>
    <button type="button" title="Insert a plain text signature divider." onClick={()=>insert("\n--\n")} className="rounded-md border px-2 py-1 text-xs">+ Divider</button>
    <button type="button" title="Insert a blank line." onClick={()=>insert("\n")} className="rounded-md border px-2 py-1 text-xs">+ Line</button>
  </div>
  <textarea id={id} aria-label={label} maxLength={4000} rows={5} value={value} onChange={event=>onChange(event.target.value)}
   placeholder={"Best regards,\nYour name\nYour company\nContact information"}
   className="w-full resize-y rounded-md border bg-background p-3 font-mono text-sm"/>
  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
    <span title="Plain text and line breaks are preserved. No HTML, colors or inferred details.">Plain-text editor · exact saved content · line breaks supported</span>
    <span>{value.length}/4000</span>
  </div>
  <pre aria-label="Signature preview" className="min-h-12 whitespace-pre-wrap break-words rounded-md border bg-background p-3 text-xs">{value||"No saved signature. Clara may choose its own closing."}</pre>
 </div>;
}
