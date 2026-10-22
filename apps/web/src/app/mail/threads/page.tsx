import { listMailThreadsForOrganization, PostgresEmailAccountRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { canReadOrganizationMail } from "@/lib/mail/mail-read-access";
import { headers } from "next/headers";
import { ThreadsClient } from "./threads-client";

export const dynamic = "force-dynamic";

export default async function ThreadsPage() {
  if (!process.env.DATABASE_URL) {
    return <Status title="Mail needs PostgreSQL" description="Configure the database to browse your organization's actual messages." />;
  }
  // Match the established Mail pages: preserve all request/session headers,
  // rather than reconstructing one guessed auth cookie.
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  if (!context?.organizationId) {
    return <Status title="Sign in to view conversations" description="Select an active organization and sign in to browse its mail threads." />;
  }

  try {
    const organizationId = context.organizationId;
    if (!(await canReadOrganizationMail(organizationId, context.membership.role))) {
      return <Status title="Threads access denied" description="Your organization role does not have email.read permission." />;
    }
    const [result, accounts] = await Promise.all([
      listMailThreadsForOrganization(organizationId, { limit: 25 }),
      new PostgresEmailAccountRepository().listForOrganization(organizationId),
    ]);
    return <ThreadsClient
      organizationId={organizationId}
      initialThreads={result.threads as never[]}
      initialHasMore={result.hasMore}
      accounts={accounts.map((account) => ({ id: account.id, label: account.email_address }))}
    />;
  } catch (error) {
    console.error("[mail/threads] load failed", error);
    return <Status title="Threads unavailable" description="Your email threads could not be loaded. Try again after the mail service reconnects." />;
  }
}

function Status({ title, description }: { title: string; description: string }) {
  return <main className="mx-auto max-w-4xl px-5 py-9 sm:px-8">
    <a href="/mail/inbox" className="text-sm text-muted-foreground hover:text-foreground">← Inbox</a>
    <div role="status" className="mt-6 rounded-md border border-border bg-card p-6">
      <h1 className="font-display text-2xl font-medium">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  </main>;
}
