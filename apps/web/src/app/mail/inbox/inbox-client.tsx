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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 100;
  const accounts = useMemo(() => Array.from(new Map(messages.map(m => [m.email_account_id, { id: m.email_account_id, label: m.account_email }])).values()), [messages]);
  async function refresh() {
    setBusy(true); setNotice(null);
    try {
      const params = new URLSearchParams({ organizationId, limit: String(PAGE_SIZE), offset: "0" });
      if (q.trim()) params.set("q", q.trim()); if (accountId !== "all") params.set("accountId", accountId);
      if (unread) params.set("unread", "true"); if (action) params.set("action", "true");
      const response = await fetch("/api/mail/inbox?" + params.toString(), { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not load inbox.");
      setMessages(data.messages ?? []);
      // If the API returned exactly PAGE_SIZE messages, there are likely more.
      setHasMore((data.messages ?? []).length === PAGE_SIZE);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load inbox."); }
    finally { setBusy(false); }
  }
  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true); setNotice(null);
    try {
      const params = new URLSearchParams({ organizationId, limit: String(PAGE_SIZE), offset: String(messages.length) });
      if (q.trim()) params.set("q", q.trim()); if (accountId !== "all") params.set("accountId", accountId);
      if (unread) params.set("unread", "true"); if (action) params.set("action", "true");
      const response = await fetch("/api/mail/inbox?" + params.toString(), { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not load more messages.");
      setMessages(prev => [...prev, ...(data.messages ?? [])]);
      setHasMore((data.messages ?? []).length === PAGE_SIZE);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load more messages."); }
    finally { setLoadingMore(false); }
  }
  useEffect(() => { const timer = setTimeout(() => { void refresh(); }, 250); return () => clearTimeout(timer); }, [q, accountId, unread, action]);
  useEffect(() => {
    // Keep the inbox fresh without requiring the user to click Sync or Refresh.
    // Provider events update PostgreSQL; this lightweight poll updates the open UI.
    let inFlight = false;
    const refreshVisibleInbox = async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const params = new URLSearchParams({ organizationId, limit: String(PAGE_SIZE), offset: "0" });
        if (q.trim()) params.set("q", q.trim());
        if (accountId !== "all") params.set("accountId", accountId);
        if (unread) params.set("unread", "true");
        if (action) params.set("action", "true");
        const response = await fetch("/api/mail/inbox?" + params.toString(), { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setMessages(data.messages ?? []);
        setHasMore((data.messages ?? []).length === PAGE_SIZE);
      } catch {
        // A temporary network failure must not interrupt inbox use; the next
        // visible tick will retry. Explicit refresh still reports errors.
      } finally {
        inFlight = false;
      }
    };
    const timer = window.setInterval(() => { void refreshVisibleInbox(); }, 5_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshVisibleInbox();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [organizationId, q, accountId, unread, action]);
  useEffect(() => { void (async()=>{ try { const params = new URLSearchParams({ organizationId }); if (accountId !== "all") params.set("accountId", accountId); const response = await fetch("/api/mail/messages/folder?" + params.toString(), { cache: "no-store" }); const data = await response.json(); if (response.ok) setFolders(data.folders ?? []); } catch {} })(); }, [organizationId, accountId]);
  async function folderAction(messageId: string, operation: "archive" | "move", folderId?: string) { setBusy(true); setNotice(null); try { const response = await fetch("/api/mail/messages/folder", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, messageIds: [messageId], action: operation, folderId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not update message folder."); await refresh(); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not update message folder."); } finally { setBusy(false); } }
  const unreadCount = messages.filter(m => !m.is_read).length; const actionCount = messages.filter(m => m.action_required).length;
  return <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10">
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><span className="grid size-7 place-items-center rounded bg-accent text-accent-foreground"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 5h16v14H4z"/><path d="m4 7 8 6 8-6"/></svg></span> Mail workspace</div><h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Inbox<span className="text-tertiary">.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Every conversation, with your agent one step ahead. Search and triage messages from your connected mailboxes.</p></div>
        <div className="flex flex-wrap gap-2"><a href="/mail/compose" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>Compose</a><a href="/mail/approvals" className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m9 12 2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>Approvals</a><a href="/mail/accounts" className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium hover:bg-secondary"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>Mailboxes</a></div>
      </header>
      <div className="mt-8 grid grid-cols-1 gap-5 border-y border-border py-7 sm:grid-cols-3 sm:gap-8">
        {[["Messages", messages.length],["Unread", unreadCount],["Needs action", actionCount]].map(([label,value])=><div key={String(label)} className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-primary/50"/>{label}</p><p className="mt-3 font-display text-3xl font-medium leading-none">{value}</p><p className="mt-2 text-[11px] text-muted-foreground">{label === "Needs action" ? "Conversations that may need a reply" : label === "Unread" ? "Unread across connected mailboxes" : "Loaded from your persisted mail store"}</p></div>)}
      </div>
      <section className="mt-8 overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b border-border p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">All conversations</h2><p className="mt-1 text-xs text-muted-foreground">Search, filter, and take action on your mail</p></div><span className="text-xs text-muted-foreground">{busy ? "Updating…" : "Live data"}</span></div><div className="flex flex-col gap-3 lg:flex-row"><label className="flex-1"><span className="sr-only">Search inbox</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search sender, subject, or message…" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20"/></label><select value={accountId} onChange={e=>setAccountId(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All mailboxes</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.label}</option>)}</select><label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm"><input type="checkbox" checked={unread} onChange={e=>setUnread(e.target.checked)}/> Unread</label><label className="flex h-11 items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={action} onChange={e=>setAction(e.target.checked)}/> Action</label><button type="button" onClick={()=>void refresh()} disabled={busy} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50">{busy ? "Refreshing…" : "Refresh"}</button></div></div>
        {notice && <div role="alert" className="border-b bg-destructive/5 px-5 py-3 text-sm text-destructive">{notice}</div>}
        {messages.length === 0 ? <div className="px-6 py-16 text-center"><div className="mx-auto grid size-12 place-items-center rounded-md bg-accent text-accent-foreground"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></div><h2 className="mt-4 font-semibold">Your inbox is empty</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Connect a mailbox and complete provider verification to begin syncing messages.</p><a href="/mail/accounts" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground">Connect a mailbox</a></div> :
        <div className="divide-y">{messages.map(m=><div key={m.id} className={"grid gap-3 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-secondary/60 sm:px-5 md:grid-cols-[220px_1fr_auto] md:items-center " + (!m.is_read ? "bg-secondary/35" : "")}>
          <a href={"/mail/thread/" + m.thread_id} className="min-w-0"><p className={"truncate text-sm " + (!m.is_read ? "font-semibold" : "text-muted-foreground")}>{m.from_address}</p><p className="mt-1 text-xs text-muted-foreground">{m.account_email}</p></a>
          <a href={"/mail/thread/" + m.thread_id} className="min-w-0"><p className={"truncate text-sm " + (!m.is_read ? "font-semibold" : "font-medium")}>{m.subject || "(No subject)"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{m.snippet || "No preview available"}</p></a>
          <div className="flex items-center gap-2 md:justify-end"><span className="text-xs text-muted-foreground">{relative(m.received_at)}</span>{m.action_required && <span className="rounded-sm bg-attention-subtle px-2 py-1 text-[10px] font-medium text-attention">Action</span>}{m.has_attachments && <span aria-label="Has attachments" className="text-xs text-muted-foreground"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m21.4 11.1-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg></span>}<button type="button" aria-label={m.is_read ? "Mark unread" : "Mark read"} disabled={busy} onClick={async()=>{setBusy(true);setNotice(null);try{const response=await fetch("/api/mail/messages/read-state",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,messageIds:[m.id],isRead:!m.is_read})});const data=await response.json();if(!response.ok)throw new Error(data.message??"Could not update message.");if(data.updated!==1)throw new Error("Message was not updated.");setMessages(current=>current.map(item=>item.id===m.id?{...item,is_read:!m.is_read}:item));}catch(error){setNotice(error instanceof Error?error.message:"Could not update message.");}finally{setBusy(false);}}} className="rounded-md border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-secondary disabled:opacity-50">{m.is_read ? "Unread" : "Read"}</button><button type="button" disabled={busy} onClick={()=>void folderAction(m.id,"archive")} className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">Archive</button>{folders.filter(f=>f.email_account_id===m.email_account_id && f.role!=="inbox").length>0 && <select aria-label="Move message" defaultValue="" disabled={busy} onChange={e=>{const value=e.target.value;if(value)void folderAction(m.id,"move",value);e.currentTarget.value="";}} className="max-w-28 rounded-lg border bg-background px-2 py-1.5 text-[11px]"><option value="">Move…</option>{folders.filter(f=>f.email_account_id===m.email_account_id).map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>}</div>
        </div>)}
        {hasMore && (
          <div className="border-b border-border px-4 py-4 text-center sm:px-5">
            <button type="button" disabled={loadingMore} onClick={() => void loadMore()} className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
              {loadingMore ? "Loading more…" : `Load more (showing ${messages.length})`}
            </button>
          </div>
        )}
      </div>}
      </section>
    </div>
  </main>;
}
