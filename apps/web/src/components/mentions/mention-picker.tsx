"use client";

import {useEffect,useMemo,useRef,useState,type RefObject} from "react";
type Mention={id:string;category:string;label:string;detail:string;insertText:string};
export function MentionPicker({organizationId,value,onChange,textareaRef}:{organizationId:string;value:string;onChange:(value:string)=>void;textareaRef:RefObject<HTMLTextAreaElement|null>}) {
 const [options,setOptions]=useState<Mention[]>([]);
 const [error,setError]=useState("");
 const [manualOpen,setManualOpen]=useState(false);
 const [query,setQuery]=useState("");
 const [typedOpen,setTypedOpen]=useState(false);
 const container=useRef<HTMLDivElement>(null);
 const endpoint="/api/organizations/"+encodeURIComponent(organizationId)+"/recipient-directory";
 useEffect(()=>{let active=true;void fetch(endpoint,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.message||"Account mentions unavailable.");if(active)setOptions(d.mentions||[]);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Account mentions unavailable.");});return()=>{active=false;};},[endpoint]);
 useEffect(()=>{const el=textareaRef.current;const pos=el?.selectionStart??value.length;const before=value.slice(0,pos);const match=/(?:^|\s)@([\w.+-]*)$/.exec(before);setTypedOpen(Boolean(match));setQuery(match?.[1]?.toLowerCase()??"");},[value,textareaRef]);
 const filtered=useMemo(()=>options.filter(item=>(item.label+" "+item.detail+" "+item.category).toLowerCase().includes(query)).slice(0,16),[options,query]);
 function choose(item:Mention){
  const el=textareaRef.current;const position=el?.selectionStart??value.length;const before=value.slice(0,position);
  const match=/(?:^|\s)@[\w.+-]*$/.exec(before);
  const at=match ? position-match[0].length+(match[0].startsWith(" ")?1:0) : position;
  const afterPos=el?.selectionEnd??position;
  const insert=item.insertText+" ";
  onChange(value.slice(0,at)+insert+value.slice(afterPos));
  setManualOpen(false);setTypedOpen(false);setQuery("");
  requestAnimationFrame(()=>{el?.focus();el?.setSelectionRange(at+insert.length,at+insert.length);});
 }
 return <div ref={container} className="relative">
  <div className="flex flex-wrap items-center gap-2">
    <button type="button" onClick={()=>{setManualOpen(v=>!v);setTypedOpen(false);setQuery("");}} className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold hover:bg-secondary" aria-expanded={manualOpen||typedOpen} aria-label="Mention connected accounts or saved recipients">@ Mention account / contact</button>
    <span className="text-[11px] text-muted-foreground">Type @ to select email, WhatsApp sender or saved recipient.</span>
  </div>
  {(manualOpen||typedOpen)&&<div role="listbox" aria-label="Account and contact mention suggestions" className="absolute bottom-full left-0 z-40 mb-2 max-h-64 w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-xl">
    {error?<p role="status" className="p-2 text-xs text-destructive">{error}</p>:filtered.length===0?<p className="p-2 text-xs text-muted-foreground">No matching authorized accounts or contacts. <a className="underline" href="/recipients">Manage recipients</a></p>:
      filtered.map(item=><button role="option" aria-selected={false} key={item.id} type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>choose(item)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-secondary focus-visible:bg-secondary"><span className="block text-xs font-semibold">{item.label}</span><span className="block text-[11px] text-muted-foreground">{item.detail}</span></button>)}
    <a href="/recipients" className="mt-1 block border-t px-2 py-2 text-xs text-primary underline">Manage primary, secondary and other contacts</a>
  </div>}
 </div>;
}
