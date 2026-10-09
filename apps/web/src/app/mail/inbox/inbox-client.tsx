"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type MailRow = {
  id: string; email_account_id: string; thread_id: string; from_address: string;
  subject: string | null; snippet: string | null; received_at: string | null;
  is_read: boolean; is_starred: boolean; importance_score: number | null;
  action_required: boolean; has_attachments: boolean; account_email: string; account_name?: string | null;
};

function relative(value: string | null) {
  if (!value) return "No date";
  const date = new Date(value); const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Just now"; if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago";
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function InboxClient({ organizationId, initialMessages }: { organizationId: string; initialMessages: MailRow[] }) {
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState(initialMessages); const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  useEffect(() => { setQ(searchParams.get("q") ?? ""); }, [searchParams]);
  const [accountId, setAccountId] = useState("all"); const [unread, setUnread] = useState(false);
  const [action, setAction] = useState(false); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const [folders, setFolders] = useState<Array<{ id: string; name: string; role: string; email_account_id: string }>>([]);
  const accounts = useMemo(() => Array.from(new Map(messages.map(m => [m.email_account_id, { id: m.email_account_id, label: m.account_email }])).values()), [messages]);
  async function refresh() {
    setBusy(true); setNotice(null);
    try {
      const params = new URLSearchParams({ organizationId, limit: "100" });
      if (q.trim()) params.set("q", q.trim()); if (accountId !== "all") params.set("accountId", accountId);
      if (unread) params.set("unread", "true"); if (action) params.set("action", "true");
      const response = await fetch("/api/mail/inbox?" + params.toString(), { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not load inbox.");
      setMessages(data.messages ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load inbox."); }
    finally { setBusy(false); }
  }
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 250); return () => clearTimeout(timer); }, [q, accountId, unread, action]);
  useEffect(() => { void (async()=>{ try { const params = new URLSearchParams({ organizationId }); if (accountId !== "all") params.set("accountId", accountId); const response = await fetch("/api/mail/messages/folder?" + params.toString(), { cache: "no-store" }); const data = await response.json(); if (response.ok) setFolders(data.folders ?? []); } catch {} })(); }, [organizationId, accountId]);
  async function folderAction(messageId: string, operation: "archive" | "move", folderId?: string) { setBusy(true); setNotice(null); try { const response = await fetch("/api/mail/messages/folder", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, messageIds: [messageId], action: operation, folderId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not update message folder."); await refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update message folder."); } finally { setBusy(false); } }
  const unreadCount = messages.filter(m => !m.is_read).length; const actionCount = messages.filter(m => m.action_required).length;
  return <main className="min-h-full bg-[radial-gradient(circle_at_top_right,oklch(0.88_0.105_152/.14),transparent_32%)] p-5 sm:p-7 lg:p-9">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Inbox</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Search and triage persisted messages from connected mailboxes. No demo messages are shown.</p></div>
        <div className="flex flex-wrap gap-2"><a href="/mail/compose" className="inline-flex h-10 items-center justify-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background hover:opacity-90">Compose</a><a href="/mail/approvals" className="inline-flex h-10 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted">Approvals</a><a href="/mail/accounts" className="inline-flex h-10 items-center justify-center rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted">Manage accounts</a></div>
      </header>
      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        {[["Messages", messages.length],["Unread", unreadCount],["Needs action", actionCount]].map(([label,value])=><div key={String(label)} className="rounded-2xl border bg-background/90 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
      </div>
      <section className="mt-5 overflow-hidden rounded-3xl border bg-background/95 shadow-sm">
        <div className="border-b p-4 sm:p-5"><div className="flex flex-col gap-3 lg:flex-row"><label className="flex-1"><span className="sr-only">Search inbox</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sender, subject, or message…" className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"/></label><select value={accountId} onChange={e=>setAccountId(e.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm"><option value="all">All mailboxes</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select><label className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm"><input type="checkbox" checked={unread} onChange={e=>setUnread(e.target.checked)}/> Unread</label><label className="flex h-11 items-center gap-2 rounded-xl border px-3 text-sm"><input type="checkbox" checked={action} onChange={e=>setAction(e.target.checked)}/> Action</label><button type="button" onClick={()=>void refresh()} disabled={busy} className="h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Refreshing…" : "Refresh"}</button></div></div>
        {notice && <div role="alert" className="border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">{notice}</div>}
        {messages.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted">✉</div><h2 className="mt-4 font-semibold">Your inbox is empty</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Connect a mailbox and complete provider verification to begin syncing messages.</p><a href="/mail/accounts" className="mt-5 inline-flex text-sm font-semibold underline underline-offset-4">Connect a mailbox</a></div> :
        <div className="divide-y">{messages.map(m=><div key={m.id} className={"grid gap-3 px-5 py-4 transition hover:bg-muted/40 md:grid-cols-[220px_1fr_auto] md:items-center " + (!m.is_read ? "bg-muted/20" : "")}>
          <a href={"/mail/thread/" + m.thread_id} className="min-w-0"><p className={"truncate text-sm " + (!m.is_read ? "font-semibold" : "text-muted-foreground")}>{m.from_address}</p><p className="mt-1 text-xs text-muted-foreground">{m.account_email}</p></a>
          <a href={"/mail/thread/" + m.thread_id} className="min-w-0"><p className={"truncate text-sm " + (!m.is_read ? "font-semibold" : "font-medium")}>{m.subject || "(No subject)"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{m.snippet || "No preview available"}</p></a>
          <div className="flex items-center gap-2 md:justify-end"><span className="text-xs text-muted-foreground">{relative(m.received_at)}</span>{m.action_required && <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">Action</span>}{m.has_attachments && <span aria-label="Has attachments" className="text-xs">📎</span>}<button type="button" aria-label={m.is_read ? "Mark unread" : "Mark read"} disabled={busy} onClick={async()=>{setBusy(true);setNotice(null);try{const response=await fetch("/api/mail/messages/read-state",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,messageIds:[m.id],isRead:!m.is_read})});const data=await response.json();if(!response.ok)throw new Error(data.message??"Could not update message.");if(data.updated!==1)throw new Error("Message was not updated.");setMessages(current=>current.map(item=>item.id===m.id?{...item,is_read:!m.is_read}:item));}catch(error){setNotice(error instanceof Error?error.message:"Could not update message.");}finally{setBusy(false);}}} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">{m.is_read ? "Unread" : "Read"}</button><button type="button" disabled={busy} onClick={()=>void folderAction(m.id,"archive")} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">Archive</button>{folders.filter(f=>f.email_account_id===m.email_account_id && f.role!=="inbox").length>0 && <select aria-label="Move message" defaultValue="" disabled={busy} onChange={e=>{const value=e.target.value;if(value)void folderAction(m.id,"move",value);e.currentTarget.value="";}} className="max-w-28 rounded-lg border bg-background px-2 py-1.5 text-[11px]"><option value="">Move…</option>{folders.filter(f=>f.email_account_id===m.email_account_id).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}</div>
        </div>)}
      </div>}
      </section>
    </div>
  </main>;
}
