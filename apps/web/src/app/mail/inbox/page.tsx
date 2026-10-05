import { listInboxMessages, PostgresEmailAccountRepository } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function MailInboxPage() {
  if (!process.env.DATABASE_URL) return <EmptyState title="Mail needs PostgreSQL" body="Configure DATABASE_URL to load persisted mailbox data. No preview messages are shown." />;
  try {
    await ensureDevSeed();
    const organizationId = getDevOrgId();
    if (!organizationId) throw new Error("Development organization could not be resolved.");
    const messages = await listInboxMessages(organizationId, { limit: 100 });
    return <InboxClient organizationId={organizationId} initialMessages={messages as never[]} />;
  } catch (error) {
    console.error("[mail/inbox] load failed", error);
    return <EmptyState title="Inbox unavailable" body="The persisted mail store could not be loaded. Check PostgreSQL and retry." error />;
  }
}

function EmptyState({ title, body, error }: { title: string; body: string; error?: boolean }) {
  return <main className="mx-auto max-w-5xl p-6 lg:p-10"><div className={"rounded-3xl border p-8 shadow-sm " + (error ? "border-destructive/20 bg-destructive/5" : "bg-background")}><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{body}</p></div></main>;
}
