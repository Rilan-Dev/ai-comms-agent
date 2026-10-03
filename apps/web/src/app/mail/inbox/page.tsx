import { mockEmailMessages, mockThreads } from "@/lib/mock-data";

export default function MailInboxPage() {
  const unread = mockEmailMessages.filter((m) => !m.is_read).length;
  const actions = mockEmailMessages.filter((m) => m.action_required).length;

  return (
    <main className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,.08),transparent_30%)] p-5 sm:p-7 lg:p-9">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Inbox</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A focused view of incoming communication, priorities, and action items. Provider sync will replace this preview data in the email integration phases.</p>
          </div>
          <div className="flex gap-2">
            <a href="/mail/accounts" className="inline-flex h-10 items-center rounded-xl border bg-background px-4 text-sm font-medium transition hover:bg-muted">Manage accounts</a>
            <a href="/agents/new" className="inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition hover:-translate-y-0.5">Create agent</a>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-background/90 p-4"><p className="text-xs text-muted-foreground">Messages</p><p className="mt-2 text-2xl font-semibold">{mockEmailMessages.length}</p></div>
          <div className="rounded-2xl border bg-background/90 p-4"><p className="text-xs text-muted-foreground">Unread</p><p className="mt-2 text-2xl font-semibold">{unread}</p></div>
          <div className="rounded-2xl border bg-background/90 p-4"><p className="text-xs text-muted-foreground">Needs action</p><p className="mt-2 text-2xl font-semibold">{actions}</p></div>
        </div>

        <section className="mt-5 overflow-hidden rounded-2xl border bg-background/95 shadow-[0_12px_40px_rgba(15,23,42,.05)]">
          <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-semibold">Priority inbox</p><p className="mt-1 text-xs text-muted-foreground">Sorted for attention, not just arrival time.</p></div>
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">Preview data</span>
          </div>
          <div className="divide-y">
            {mockEmailMessages.map((msg) => (
              <article key={msg.id} className="group grid gap-3 px-5 py-4 transition hover:bg-muted/40 md:grid-cols-[220px_1fr_auto] md:items-center">
                <div className="min-w-0">
                  <p className={`truncate text-sm ${msg.is_read ? "text-muted-foreground" : "font-semibold"}`}>{msg.from_address}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{msg.received_at}</p>
                </div>
                <div className="min-w-0">
                  <p className={`truncate text-sm ${msg.is_read ? "font-medium" : "font-semibold"}`}>{msg.subject}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{msg.snippet}</p>
                </div>
                <div className="flex items-center gap-2 md:justify-end">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${msg.importance_score >= .7 ? "bg-red-50 text-red-700" : msg.importance_score >= .4 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>{Math.round(msg.importance_score * 100)}% priority</span>
                  {msg.action_required && <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">Action</span>}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-2xl border bg-background/95 p-5 shadow-[0_12px_40px_rgba(15,23,42,.04)]">
          <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Threads</p><p className="mt-1 text-xs text-muted-foreground">Conversation-level context for the agent.</p></div><span className="text-xs text-muted-foreground">{mockThreads.length} threads</span></div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {mockThreads.map((thread) => (
              <div key={thread.id} className="rounded-xl border p-4 transition hover:-translate-y-0.5 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{thread.subject}</span><span className="shrink-0 text-[11px] text-muted-foreground">{thread.message_count} msgs</span></div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{thread.snippet}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
