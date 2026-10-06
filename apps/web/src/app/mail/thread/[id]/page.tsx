import { getMailThreadForOrganization } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { ThreadActions } from "../thread-actions";

export const dynamic = "force-dynamic";

export default async function MailThreadPage({ params }: { params: Promise<{ id: string }> }) {
  if (!process.env.DATABASE_URL) return <State title="Thread unavailable" body="PostgreSQL is required for persisted mail." />;
  try {
    await ensureDevSeed();
    const organizationId = getDevOrgId();
    if (!organizationId) throw new Error("Organization unavailable.");
    const { id } = await params;
    const messages = await getMailThreadForOrganization(organizationId, id);
    if (!messages.length) return <State title="Thread not found" body="This thread does not exist in the current organization." />;
    const subject = String(messages[0].subject ?? "(No subject)");
    return <main className="min-h-full bg-muted/20 p-5 sm:p-7 lg:p-9"><div className="mx-auto max-w-4xl">
      <a href="/mail/inbox" className="text-sm font-semibold text-muted-foreground hover:text-foreground">← Back to inbox</a>
      <header className="mt-6 rounded-3xl border bg-background p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Conversation</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{subject}</h1><p className="mt-2 text-sm text-muted-foreground">{messages.length} message{messages.length === 1 ? "" : "s"} · {String(messages[0].account_email)}</p></div><div className="flex gap-2"><a href="/mail/compose" className="rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted">Compose</a><a href="/mail/inbox" className="rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background">Back to inbox</a></div></div></header>
      <section className="mt-5 space-y-3">{messages.map((m) => <article key={String(m.id)} className="rounded-3xl border bg-background p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{String(m.from_address)}</p><p className="mt-1 text-xs text-muted-foreground">{m.received_at ? new Date(String(m.received_at)).toLocaleString() : "No date"}</p></div>{Boolean(m.is_read) ? null : <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Unread</span>}</div><div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-foreground">{String(m.text_body ?? m.snippet ?? "No message body available.")}</div>{Boolean(m.has_attachments) && <p className="mt-5 text-xs font-medium text-muted-foreground">This message has attachments. Secure attachment actions will be enabled when the storage/scan pipeline is connected.</p>}</article>)}</section>
      <ThreadActions
        organizationId={organizationId}
        emailAccountId={String(messages[0].email_account_id)}
        messageId={String(messages[messages.length - 1].id)}
      />
    </div></main>;
  } catch (error) {
    console.error("[mail/thread] load failed", error);
    return <State title="Thread unavailable" body="The persisted mail store could not be loaded. Check PostgreSQL and retry." />;
  }
}

function State({ title, body }: { title: string; body: string }) {
  return <main className="mx-auto max-w-4xl p-6 lg:p-10"><a href="/mail/inbox" className="text-sm font-semibold text-muted-foreground">← Back to inbox</a><div className="mt-6 rounded-3xl border bg-background p-8 shadow-sm"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div></main>;
}
