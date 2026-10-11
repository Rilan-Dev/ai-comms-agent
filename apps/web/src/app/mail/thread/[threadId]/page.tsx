import { getMailThreadForOrganization } from "@ai-comms-agent/db";
import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { ThreadClient } from "./thread-client";

export const dynamic = "force-dynamic";

export default async function MailThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  if (!process.env.DATABASE_URL) return <State title="Mail needs PostgreSQL" body="Configure DATABASE_URL to open persisted threads." />;
  try {
    await ensureDevSeed();
    const organizationId = getDevOrgId();
    if (!organizationId) throw new Error("Development organization could not be resolved.");
    const messages = await getMailThreadForOrganization(organizationId, threadId);
    if (!messages.length) return <State title="Thread not found" body="This thread is unavailable in the current organization." />;
    return <ThreadClient organizationId={organizationId} threadId={threadId} initialMessages={messages as never[]} />;
  } catch {
    return <State title="Thread unavailable" body="The persisted thread could not be loaded. Retry from the inbox." error />;
  }
}

function State({ title, body, error }: { title: string; body: string; error?: boolean }) {
  return <main className="mx-auto max-w-4xl p-6 lg:p-10"><a href="/mail/inbox" className="text-sm font-semibold underline underline-offset-4">← Inbox</a><div className={"mt-6 rounded-3xl border p-8 " + (error ? "border-destructive/20 bg-destructive/5" : "bg-background")}><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div></main>;
}
