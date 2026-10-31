import { cookies } from "next/headers";
import { getMailThreadForOrganization, PostgresEmailAccountRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { canReadOrganizationMail } from "@/lib/mail/mail-read-access";
import { redirect } from "next/navigation";
import { ThreadClient } from "./thread-client";

export const dynamic = "force-dynamic";

export default async function MailThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  if (!process.env.DATABASE_URL) return <State title="Mail needs PostgreSQL" body="Configure DATABASE_URL to open persisted threads." />;
  try {
    // Resolve the user's REAL organization context from the auth cookie —
    // not the dev org ID. The old version called getDevOrgId() which only
    // works when ACA_ENABLE_DEV_IDENTITY=true. In production the user's
    // auth cookie resolves to a real org membership; getDevOrgId returned
    // undefined and the page fell through to "Thread not found".
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("aca-access-token")?.value;
    const authHeaders = new Headers();
    if (accessToken) authHeaders.set("cookie", `aca-access-token=${encodeURIComponent(accessToken)}`);
    const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: authHeaders }));
    if (!context) redirect("/login?reason=not_provisioned");
    const organizationId = context.organizationId;
    if (!(await canReadOrganizationMail(organizationId, context.membership.role))) {
      return <State title="Thread access denied" body="Your organization role does not have email.read permission." />;
    }
    const messages = await getMailThreadForOrganization(organizationId, threadId);
    if (!messages.length) return <State title="Thread not found" body="This thread is unavailable in the current organization." />;
    const account = await new PostgresEmailAccountRepository().getById(String(messages[0]?.email_account_id ?? ""));
    if (!account || account.organization_id !== organizationId) return <State title="Mailbox unavailable" body="This thread’s mailbox could not be loaded." />;
    return <ThreadClient organizationId={organizationId} threadId={threadId} initialMessages={messages as never[]} capabilities={account.capabilities} />;
  } catch {
    return <State title="Thread unavailable" body="The persisted thread could not be loaded. Retry from the inbox." error />;
  }
}

function State({ title, body, error }: { title: string; body: string; error?: boolean }) {
  return <main className="mx-auto max-w-4xl p-6 lg:p-10"><a href="/mail/inbox" className="text-sm font-semibold underline underline-offset-4">← Inbox</a><div className={"mt-6 rounded-3xl border p-8 " + (error ? "border-destructive/20 bg-destructive/5" : "bg-background")}><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div></main>;
}
