import { listInboxMessages, PostgresEmailAccountRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { canReadOrganizationMail } from "@/lib/mail/mail-read-access";
import { headers } from "next/headers";
import { InboxClient } from "./inbox-client";

export const dynamic = "force-dynamic";

export default async function MailInboxPage() {
  if (!process.env.DATABASE_URL) return <EmptyState title="Mail needs PostgreSQL" body="Configure DATABASE_URL to load persisted mailbox data. No preview messages are shown." />;
  try {
    const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
    const organizationId = context?.organizationId;
    if (!organizationId || !context) throw new Error("Organization context is unavailable.");
    if (!(await canReadOrganizationMail(organizationId, context.membership.role))) {
      return <EmptyState title="Inbox access denied" body="Your organization role does not have email.read permission." />;
    }
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
