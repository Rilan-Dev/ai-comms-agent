"use client";

import {useId,useState} from 'react';
import {splitSenderEntries} from '@/lib/agents/sender-entries';

export function SenderListEditor({name,label,initialEntries,disabled=false}:{name:'allowedSenders'|'blockedSenders';label:string;initialEntries:readonly string[];disabled?:boolean}){
 const id=useId();const [entries,setEntries]=useState([...initialEntries]);const [pending,setPending]=useState('');const [error,setError]=useState('');
 function add(values:string[]){
  if(entries.length+values.length>100){setError('Keep up to 100 entries. Remove an entry before adding more.');return;}
  setEntries([...entries,...values]);setPending('');setError('');
 }
 return <fieldset className="space-y-2" disabled={disabled} aria-describedby={`${id}-help`}>
  <legend className="text-sm font-medium">{label}</legend>
  <p id={`${id}-help`} className="text-xs text-muted-foreground">Add an entry, or paste a comma-separated list. Up to 100 entries.</p>
  {entries.map((entry,index)=><div key={index} className="flex gap-2">
   <input name={name} aria-label={`${label} entry ${index+1}`} value={entry} onChange={event=>setEntries(entries.map((value,i)=>i===index?event.target.value:value))} className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" />
   <button type="button" aria-label={`Remove ${label.toLowerCase()} entry ${index+1}`} onClick={()=>{setEntries(entries.filter((_,i)=>i!==index));setError('');}} className="rounded-md border px-3 text-xs">Remove</button>
  </div>)}
  <div className="flex gap-2">
   <input name={name} aria-label={`New ${label.toLowerCase()} entry`} value={pending} disabled={disabled||entries.length>=100} onChange={event=>setPending(event.target.value)}
    onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();if(pending.trim())add(splitSenderEntries(pending));}}}
    onPaste={event=>{const pasted=event.clipboardData.getData('text');if(/[,\r\n]/.test(pasted)){event.preventDefault();const input=event.currentTarget;add(splitSenderEntries(pending.slice(0,input.selectionStart??pending.length)+pasted+pending.slice(input.selectionEnd??pending.length)));}}}
    placeholder="Add entry" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" />
   <button type="button" disabled={disabled||!pending.trim()||entries.length>=100} onClick={()=>add(splitSenderEntries(pending))} className="rounded-md border px-3 text-xs disabled:opacity-50">Add</button>
  </div>
  <p className="text-xs text-muted-foreground" role="status">{entries.length} of 100 entries{error?` · ${error}`:''}</p>
 </fieldset>;
}
