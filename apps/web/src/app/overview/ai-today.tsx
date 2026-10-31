"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {aiTodayBriefingChatHref,aiTodayChatHref, type AiTodayDays, type AiTodaySnapshot} from "@/lib/ai-today/snapshot";

const windows = [1,5,7,30] as const;
const priorityLabel:Record<AiTodaySnapshot["items"][number]["priority"],string> = {
  action_required:"Action required (saved flag)",
  starred:"Starred",
  important:"High importance (saved score)",
  unread:"Unread",
};
const time = (value: string | null) => value ? new Date(value).toLocaleString() : "Not recorded";

export function AiToday({organizationId}:{organizationId:string}) {
  const [days,setDays]=useState<AiTodayDays>(5);
  const [agentId,setAgentId]=useState("");
  const [visitError,setVisitError]=useState("");
  const [reload,setReload]=useState(0);
  const [snapshot,setSnapshot]=useState<AiTodaySnapshot|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    setSnapshot(null);setError("");setLoading(true);
    const params=new URLSearchParams({organizationId,days:String(days)});
    if(agentId)params.set("agentId",agentId);
    void fetch(`/api/ai-today?${params}`,{cache:"no-store",signal:controller.signal})
      .then(async response=>{
        if(!response.ok){
          if(response.status===403)return Promise.reject(new Error("Email read access is required for AI Today."));
          if(response.status===401)return Promise.reject(new Error("Sign in to view AI Today."));
          throw new Error("AI Today could not load your current mail sources.");
        }
        return response.json() as Promise<{snapshot:AiTodaySnapshot}>;
      })
      .then(data=>{
        if(controller.signal.aborted)return;
        setSnapshot(data.snapshot);
        // Persist a foreground visit after capturing the previous visit.
        if(data.snapshot.agentId)void fetch("/api/ai-today/visit",{
          method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({organizationId,agentId:data.snapshot.agentId})
        }).then(response=>{
          if(!response.ok && !controller.signal.aborted)setVisitError("Visit history was not recorded.");
        }).catch(()=>{if(!controller.signal.aborted)setVisitError("Visit history was not recorded.");});
      })
      .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:"AI Today is unavailable.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[organizationId,days,agentId,reload]);
  return <section aria-labelledby="ai-today-title" className="workspace-panel p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Executive command center · Phase 1</p>
        <h2 id="ai-today-title" className="mt-2 font-display text-2xl font-semibold">AI Today</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Source-backed catch-up, saved action flags and your current work. No AI-generated conclusions or automatic sends.</p>
      </div>
      <button type="button" onClick={()=>setReload(n=>n+1)} className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-secondary">Refresh sources</button>
    </div>
    {snapshot?.agents && snapshot.agents.length>1&&<label className="mt-4 flex max-w-sm flex-col gap-1 text-xs font-semibold">Assistant mailbox scope
      <select aria-label="Assistant mailbox scope" className="rounded-lg border bg-background p-2" value={snapshot.agentId??""} onChange={event=>setAgentId(event.target.value)}>
        {snapshot.agents.map(agent=><option key={agent.id} value={agent.id}>{agent.name} · {agent.mailboxCount} granted mailbox{agent.mailboxCount===1?"":"es"}</option>)}
      </select>
    </label>}
    {visitError&&<p className="mt-2 text-xs text-muted-foreground" role="status">{visitError}</p>}
    <div className="mt-5 flex flex-wrap items-center gap-2" role="group" aria-label="Lookback window">
      {windows.map(value=><button key={value} type="button" aria-pressed={days===value}
        onClick={()=>setDays(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${days===value?"border-primary bg-secondary":"hover:bg-secondary"}`}>{value===1?"Last 24 hours":`Last ${value} days`}</button>)}
    </div>
    {loading&&<p role="status" className="mt-5 text-sm text-muted-foreground">Checking connected inbox sources…</p>}
    {error&&<div role="alert" className="mt-5 rounded-lg border p-4 text-sm"><p>{error}</p><Link href="/mail/inbox" className="mt-3 inline-block font-semibold underline">Open inbox</Link></div>}
    {snapshot&&!loading&&<AiTodaySnapshotView snapshot={snapshot}/>}
  </section>;
}

export function AiTodaySnapshotView({snapshot}:{snapshot:AiTodaySnapshot}){
  return <div className="mt-5 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>Source-backed · {snapshot.connectedMailboxes} connected mailbox{snapshot.connectedMailboxes===1?"":"es"} · Snapshot {time(snapshot.asOf)}</span>
      <span>{snapshot.lastSyncAt?`Latest recorded sync: ${time(snapshot.lastSyncAt)}`:"Sync freshness not available"}</span>
      <span>{snapshot.lastVisitAt?`Previous visit: ${time(snapshot.lastVisitAt)}`:"No previous visit recorded"}</span>
    </div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Link href="/mail/inbox" className="rounded-xl border bg-secondary/30 p-4 hover:bg-secondary"><p className="text-xs text-muted-foreground">Relevant message sources</p><p className="mt-2 font-display text-2xl font-semibold">{snapshot.totalMatches}</p><p className="mt-1 text-xs text-muted-foreground">In selected window · View inbox</p></Link>
      <Link href="/mail/drafts" className="rounded-xl border bg-secondary/30 p-4 hover:bg-secondary"><p className="text-xs text-muted-foreground">Your pending email approvals</p><p className="mt-2 font-display text-2xl font-semibold">{snapshot.pendingEmailApprovals??"Restricted"}</p><p className="mt-1 text-xs text-muted-foreground">Review drafts</p></Link>
      <Link href="/whatsapp" className="rounded-xl border bg-secondary/30 p-4 hover:bg-secondary"><p className="text-xs text-muted-foreground">Your pending WhatsApp approvals</p><p className="mt-2 font-display text-2xl font-semibold">{snapshot.pendingWhatsAppApprovals??"Restricted"}</p><p className="mt-1 text-xs text-muted-foreground">Review WhatsApp sends</p></Link>
    </div>
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-lg font-semibold">What deserves a look</h3><Link href="/mail/inbox" className="text-xs font-semibold underline">All messages ↗</Link></div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">Selected only from mailboxes both granted to you and bound to this assistant. Prioritized by saved action, star and importance indicators. This is not a complete or inferred AI summary. Opening this view does not mark mail as read.</p>
      {snapshot.agents?.length===0&&<p className="mt-3 rounded-lg border p-4 text-sm">No granted assistant mailboxes are available. Ask an organization administrator to assign explicit personal briefing access and bind a connected mailbox to your agent.</p>}
      {!!snapshot.agentId && snapshot.items.length>0&&<Link href={aiTodayBriefingChatHref(snapshot)} className="mt-3 inline-block rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-secondary">Prepare an AI briefing in Chat from these sources ↗</Link>}
      {snapshot.totalMatches>snapshot.items.length&&<p className="mt-3 text-xs text-muted-foreground">Showing {snapshot.items.length} of {snapshot.totalMatches} matching sources. Open inbox to see the rest.</p>}
      {!snapshot.items.length?<p className="mt-4 rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No matching unread, starred or action-flagged messages in this window. This does not prove that every account has finished syncing.</p>:
      <div className="mt-4 divide-y divide-border">{snapshot.items.map(item=><article key={item.messageId} className="py-4 first:pt-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span className="rounded-md border px-2 py-1 font-semibold">{priorityLabel[item.priority]}</span><span>{item.accountEmail}</span><span>{time(item.receivedAt)}</span></div>
        <p className="mt-2 text-sm font-semibold">{item.subject}</p>
        <p className="mt-1 text-xs text-muted-foreground">From {item.sender}</p>
        {item.snippet&&<p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.snippet}</p>}
        {item.actionDeadline&&<p className="mt-2 text-xs text-muted-foreground">Recorded deadline: {time(item.actionDeadline)}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
          <Link href={`/mail/thread/${encodeURIComponent(item.threadId)}`} className="underline underline-offset-4">Open original email ↗</Link>
          <Link href={aiTodayChatHref(item.messageId,snapshot.agentId)} className="underline underline-offset-4">Ask AI to prepare a reply ↗</Link>
        </div>
      </article>)}</div>}
    </div>
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-display text-lg font-semibold">Your scheduled activity</h3><Link href="/scheduled" className="text-xs font-semibold underline">Manage schedules ↗</Link></div>
      {snapshot.schedules.length===0?<p className="mt-3 text-sm text-muted-foreground">No active or attention-needed schedules created by your account.</p>:
        <ul className="mt-3 space-y-3">{snapshot.schedules.map(schedule=><li key={schedule.id} className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{schedule.name}</p><p className="text-xs text-muted-foreground">{schedule.status} · Last run {time(schedule.lastFireAt)}</p></div><span className="text-xs text-muted-foreground">Next {time(schedule.nextFireAt)}</span></li>)}</ul>}
    </div>
    <p className="text-xs leading-5 text-muted-foreground">This view requires email.read, your personal mailbox grants and an active agent binding. It uses stored source fields and may lag live provider mail. Chat generation is an explicit, source-limited request and may be unavailable; background personal briefings remain gated.</p>
  </div>;
}
