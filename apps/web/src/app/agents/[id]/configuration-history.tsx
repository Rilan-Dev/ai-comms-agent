"use client";

import {useState} from 'react';
import type {ConfigurationEditor} from './use-configuration-editor';

export function ConfigurationHistory({editor,legacyVersions}:{editor:ConfigurationEditor;legacyVersions:Array<{id:string;versionNumber:number}>}) {
 const [error,setError]=useState('');
 if(!editor.enabled||!editor.view)return null;
 const blocked=editor.busy||editor.dirty.length>0||Boolean(editor.view.draft);
 return <section aria-label="Configuration history" className="rounded-md border bg-background p-6 shadow-sm">
  <h2 className="font-semibold">Configuration history</h2>
  <p className="mt-1 text-sm text-muted-foreground">Restore creates a draft for review. It does not send messages or apply changes.</p>
  {editor.view.draft&&<p className="mt-3 text-xs text-muted-foreground">Apply or discard your current draft before restoring another version.</p>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  <ul className="mt-4 divide-y">{editor.view.history.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><span className="font-medium">Revision {item.revisionNumber}</span><span className="ml-2 text-xs text-muted-foreground">{item.state==='active'?'Active':item.state==='superseded'?'Previously active':'Unapplied revision'} · {new Date(item.createdAt).toLocaleString()}</span>{item.coverage==='legacy_partial'&&<p className="mt-1 text-xs text-muted-foreground">Legacy version: runtime settings only.</p>}</div>{item.state==='superseded'&&<button type="button" disabled={blocked} onClick={()=>{setError('');void editor.restore(item.id).catch(reason=>setError(reason instanceof Error?reason.message:'Restore unavailable.'));}} className="h-10 rounded-md border px-3 font-medium disabled:opacity-50">Restore as draft</button>}</li>)}</ul>
  {legacyVersions.length>0&&<details className="mt-4 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Restore an older runtime version</summary><p className="mt-2 text-xs text-muted-foreground">Older versions include runtime settings only. Other current settings remain unchanged.</p><ul className="mt-2 divide-y">{legacyVersions.map(item=><li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span>Version {item.versionNumber}</span><button type="button" disabled={blocked} onClick={()=>{setError('');void editor.restore(item.id).catch(reason=>setError(reason instanceof Error?reason.message:'Restore unavailable.'));}} className="h-10 rounded-md border px-3 font-medium disabled:opacity-50">Restore as draft</button></li>)}</ul></details>}
 </section>;
}
