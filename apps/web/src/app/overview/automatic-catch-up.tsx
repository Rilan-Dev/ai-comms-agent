"use client";
import {useEffect,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import type {BriefingItem,BriefingRead} from '@ai-comms-agent/shared';
import {CatchUpCards} from './catch-up-cards';

type Choice={agentId:string;name:string;mailboxes:Array<{id:string;emailAddress:string}>};
type Context={agents:Choice[];setup:Choice[];userId:string;defaultAgentId:string|null};
type Source={messageId:string;threadId:string;subject?:string;sender?:string};
const button='rounded-md border border-border px-3 py-2 text-sm disabled:opacity-50';

export function AutomaticCatchUp({organizationId}:{organizationId:string}){
  const [context,setContext]=useState<Context|null>(null);const [agentId,setAgentId]=useState('');
  const [error,setError]=useState('');const [attempt,setAttempt]=useState(0);const [connecting,setConnecting]=useState(false);
  useEffect(()=>{
    const abort=new AbortController();
    void fetch(`/api/organizations/${organizationId}/briefing-agents`,{signal:abort.signal,cache:'no-store'})
      .then(async response=>{if(!response.ok)throw Error('Your catch-up access could not be checked.');return response.json() as Promise<Context>;})
      .then(data=>{if(!abort.signal.aborted){setContext(data);setAgentId(data.defaultAgentId??'');setError('');}})
      .catch(cause=>{if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Catch-up is unavailable.');});
    return()=>abort.abort();
  },[organizationId,attempt]);
  async function connect(choice:Choice){
    if(!context||connecting)return;setConnecting(true);setError('');
    try{
      for(const mailbox of choice.mailboxes){
        const response=await fetch(`/api/organizations/${organizationId}/briefing-access`,{method:'POST',headers:{'content-type':'application/json'},
          body:JSON.stringify({targetUserId:context.userId,mailboxId:mailbox.id,reason:'Owner enabled personal Overview catch-up for assigned mailbox'})});
        if(!response.ok)throw Error('Access could not be saved. Your existing mailbox permissions remain in place.');
      }
      setAttempt(value=>value+1);
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not connect catch-up.');}finally{setConnecting(false);}
  }
  const agent=context?.agents.find(choice=>choice.agentId===agentId);
  return <section aria-labelledby="personal-catch-up-title" className="rounded-xl border border-border bg-card p-5 sm:p-7">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your inbox, at a glance</p><h2 id="personal-catch-up-title" className="mt-2 font-display text-2xl font-medium">Here’s what needs you</h2></div><a href="/mail/inbox" className={button}>Open inbox</a></div>
    <p className="mt-2 text-sm text-muted-foreground">Important mail first. You choose what to review.</p>
    {error&&<p role="alert" className="mt-4 text-sm">{error} <button className="underline" onClick={()=>setAttempt(value=>value+1)}>Try again</button></p>}
    {!context&&!error&&<p role="status" className="mt-4 text-sm">Checking your inbox access…</p>}
    {context&&!context.agents.length&&<div className="mt-4 space-y-3"><p className="text-sm text-muted-foreground">Choose an assigned inbox for your private catch-up. This does not enable sending.</p>
      {context.setup.length?context.setup.map(choice=><div key={choice.agentId} className="rounded-lg border border-border p-4"><p className="text-sm font-medium">{choice.name}</p><p className="my-2 text-sm text-muted-foreground">{choice.mailboxes.map(mailbox=>mailbox.emailAddress).join(' · ')}</p><button disabled={connecting} className={button} onClick={()=>void connect(choice)}>{connecting?'Connecting…':'Use these inboxes for my catch-up'}</button></div>):<Link href="/agents" className="inline-block text-sm underline">Ask your workspace owner to assign inbox access</Link>}
    </div>}
    {context&&context.agents.length>1&&<label className="mt-4 block text-sm">Assistant<select value={agentId} onChange={event=>setAgentId(event.target.value)} className="mt-1 block rounded-md border border-border bg-card p-2"><option value="">Choose your assistant</option>{context.agents.map(choice=><option key={choice.agentId} value={choice.agentId}>{choice.name}</option>)}</select></label>}
    {agent&&<SummarySession key={`${organizationId}:${agent.agentId}:${attempt}`} organizationId={organizationId} agent={agent}/>}
  </section>;
}

function SummarySession({organizationId,agent}:{organizationId:string;agent:Choice}){
  const router=useRouter();const [detail,setDetail]=useState<BriefingRead|null>(null);const [status,setStatus]=useState('Checking which emails are still unread…');
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [refresh,setRefresh]=useState(0);const [originals,setOriginals]=useState<Source[]>([]);
  const sequence=useRef(0);const current=useRef(true);const manifestId=useRef<string|null>(null);
  const base=`/api/organizations/${organizationId}/briefings`;
  useEffect(()=>{
    // Coarse foreground presence is separate from passive summary polling,
    // personal review and provider read state. The server supplies the clock.
    const visible=()=>{if(document.visibilityState==='visible')void fetch(`${base}/foreground`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agentId:agent.agentId})}).catch(()=>undefined);};
    visible();document.addEventListener('visibilitychange',visible);const timer=setInterval(visible,60_000);
    return()=>{document.removeEventListener('visibilitychange',visible);clearInterval(timer);};
  },[base,agent.agentId]);
  async function loadDetail(id:string,signal?:AbortSignal){
    const ticket=++sequence.current;
    const response=await fetch(`${base}/${id}?agentId=${agent.agentId}`,{cache:'no-store',signal});
    if(!response.ok){if(current.current&&ticket===sequence.current)setDetail(null);throw Error('Your summary could not be refreshed.');}
    const data=await response.json() as BriefingRead;
    if(data.manifest.scope.organizationId!==organizationId||data.manifest.scope.agentId!==agent.agentId)throw Error('Your assistant selection changed. Refresh to continue.');
    if(current.current&&ticket===sequence.current)setDetail(data);
    return data;
  }
  useEffect(()=>{
    current.current=true;const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let ticks=0;
    const requestKey=crypto.randomUUID();
    const later=(run:()=>Promise<void>)=>{timer=setTimeout(()=>{if(!abort.signal.aborted)void run();},6_000);};
    async function poll(){
      if(abort.signal.aborted)return;
      try{
        if(!manifestId.current){
          const response=await fetch(base,{method:'POST',headers:{'content-type':'application/json'},signal:abort.signal,
            body:JSON.stringify({agentId:agent.agentId,mailboxIds:agent.mailboxes.map(mailbox=>mailbox.id),mode:'catch_up',period:null,language:'en',requestKey})});
          if(response.status===409){if(++ticks<60)later(poll);else setStatus('Read status is taking longer to check. Try again shortly.');return;}
          if(!response.ok)throw Error('Your catch-up could not start. Please try again.');
          const payload=await response.json() as {manifest:{id:string}};if(abort.signal.aborted)return;manifestId.current=payload.manifest.id;
        }
        const data=await loadDetail(manifestId.current,abort.signal);if(abort.signal.aborted)return;
        if(data.manifest.status==='invalidated'){setError('Your inbox changed. Refresh to prepare an up-to-date catch-up.');return;}
        if(data.manifest.status==='failed'){setError('Your assistant could not finish this summary. You can still open your inbox.');return;}
        setStatus(data.manifest.status==='pending'?'Your assistant is preparing your catch-up…':data.manifest.status==='partial'?'Some emails need the original checked.':'Up to date for this selection');
        if(data.manifest.status==='pending'){
          if(++ticks<60)later(poll);
          else setStatus('Your assistant is still working in the background. Refresh to check progress.');
        }
      }catch(cause){if(!abort.signal.aborted)setError(cause instanceof Error?cause.message:'Catch-up is unavailable.');}
    }
    void poll();
    // Invalidate requests rather than capturing a past counter value: a late
    // response from this session must never replace a refreshed selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return()=>{current.current=false;sequence.current++;abort.abort();if(timer)clearTimeout(timer);};
    // Each session has one immutable agent/mailbox scope; changing it remounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[refresh]);
  async function review(id:string){
    if(!detail||busy)return;setBusy(true);setError('');
    try{
      const response=await fetch(`${base}/${detail.manifest.id}/review`,{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({agentId:agent.agentId,itemIds:[id],expectedScopeVersion:detail.manifest.scope.scopeVersion})});
      if(!response.ok)throw Error('Review could not be saved. Refresh to check the current email.');
      await loadDetail(detail.manifest.id);
    }catch(cause){if(current.current)setError(cause instanceof Error?cause.message:'Review could not be saved.');}finally{if(current.current)setBusy(false);}
  }
  async function open(item:BriefingItem){
    if(!detail||busy)return;setBusy(true);setError('');
    try{
      let cursor:string|null=null;const found:Source[]=[];
      for(let page=0;page<Math.ceil(detail.manifest.sourceCount/200);page++){
        const params=new URLSearchParams({agentId:agent.agentId,limit:'200'});if(cursor)params.set('cursor',cursor);
        const response=await fetch(`${base}/${detail.manifest.id}/sources?${params}`,{cache:'no-store'});
        if(!response.ok)throw Error('The original email changed or access is unavailable.');
        const data=await response.json() as {items:Source[];nextCursor:string|null};
        found.push(...data.items.filter(source=>item.sourceIds.includes(source.messageId)));cursor=data.nextCursor;
        if(!cursor||found.length===item.sourceIds.length)break;
      }
      if(!current.current)return;if(found.length!==item.sourceIds.length)throw Error('Refresh to check the current email sources.');
      if(found.length===1)router.push(`/mail/thread/${encodeURIComponent(found[0]!.threadId)}`);else setOriginals(found);
    }catch(cause){if(current.current)setError(cause instanceof Error?cause.message:'Original email unavailable.');}finally{if(current.current)setBusy(false);}
  }
  return <div className="mt-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><p>{agent.name} · {agent.mailboxes.map(mailbox=>mailbox.emailAddress).join(' · ')}</p><button className="underline" disabled={busy} onClick={()=>{manifestId.current=null;setDetail(null);setOriginals([]);setError('');setRefresh(value=>value+1);}}>Refresh catch-up</button></div>
    <p role="status" className="text-sm text-muted-foreground">{status}</p>
    {error&&<p role="alert" className="text-sm">{error}</p>}
    {detail&&detail.manifest.status!=='invalidated'&&(detail.items.length>0||detail.manifest.status==='ready')&&<CatchUpCards items={detail.items} reviewedItemIds={detail.reviewedItemIds??[]} onReview={id=>void review(id)} onOpen={item=>void open(item)} busy={busy} completeSelection={detail.manifest.status==='ready'}/>}
    {!!originals.length&&<nav aria-label="Original emails" className="rounded-lg border border-border p-4"><h3 className="text-sm font-medium">Original emails</h3>{originals.map(source=><a key={source.messageId} className="mt-2 block text-sm underline" href={`/mail/thread/${encodeURIComponent(source.threadId)}`}>{source.subject||'Open email'}{source.sender?` · ${source.sender}`:''}</a>)}</nav>}
    <p className="text-xs text-muted-foreground">Review progress is saved across devices. Opening Overview does not mark emails as read.</p>
  </div>;
}
