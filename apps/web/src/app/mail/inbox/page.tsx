import { mockEmailMessages } from "@/lib/mock-data";

export default function MailInboxPage() {
  return <main className="mx-auto max-w-[1400px] space-y-6 p-5 sm:p-7 lg:p-9">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Inbox</h1><p className="mt-2 text-sm text-muted-foreground">Prioritized conversations across your connected accounts.</p></div>
      <div className="flex gap-2"><a href="/mail/accounts" className="rounded-xl border px-4 py-2.5 text-xs font-semibold hover:bg-muted">Manage accounts</a><button className="rounded-xl bg-foreground px-4 py-2.5 text-xs font-semibold text-background">Compose</button></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border bg-background p-5"><p className="text-xs text-muted-foreground">Unread</p><p className="mt-2 text-2xl font-semibold">24</p></div><div className="rounded-2xl border bg-background p-5"><p className="text-xs text-muted-foreground">Needs action</p><p className="mt-2 text-2xl font-semibold">7</p></div><div className="rounded-2xl border bg-background p-5"><p className="text-xs text-muted-foreground">AI drafts</p><p className="mt-2 text-2xl font-semibold">3</p></div></div>
    <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b px-5 py-4"><p className="text-sm font-semibold">Priority inbox</p><span className="text-xs text-muted-foreground">Today</span></div>
      <div className="divide-y">{mockEmailMessages.map(msg=><div key={msg.id} className="grid gap-3 px-5 py-4 transition hover:bg-muted/40 sm:grid-cols-[180px_1fr_auto] sm:items-center">
        <div className={`text-sm ${msg.is_read?"text-muted-foreground":"font-semibold"}`}>{msg.from_address}</div>
        <div className="min-w-0"><p className={`truncate text-sm ${msg.is_read?"font-medium":"font-semibold"}`}>{msg.subject}</p><p className="mt-1 truncate text-xs text-muted-foreground">{msg.snippet}</p></div>
        <div className="flex items-center gap-2 text-[11px]">{msg.action_required&&<span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">Action</span>}{msg.importance_score>=.7&&<span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700">Important</span>}</div>
      </div>)}</div>
    </div>
  </main>;
}
