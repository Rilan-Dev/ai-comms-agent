import { PostgresEmailAccountRepository } from "@ai-comms-agent/db";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { EmailAccountsClient } from "./email-accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <div className="rounded-3xl border bg-background p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mail</p>
          <h1 className="mt-2 text-2xl font-semibold">Email accounts need PostgreSQL</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            This screen uses persisted account records. Configure DATABASE_URL for the runtime; no demo accounts are shown.
          </p>
        </div>
      </main>
    );
  }

  try {
    // Resolve the same authenticated user's active organization used by the
    // protected application shell. Never seed or select the development org
    // for a production mailbox screen; doing so sends API calls across tenants.
    const context = await getAuthenticatedAppContext(
      new Request("http://localhost", { headers: await headers() }),
    );
    const organizationId = context?.organizationId;
    if (!organizationId) throw new Error("Organization context is unavailable.");

    const accounts = await new PostgresEmailAccountRepository().listForOrganization(organizationId);
    return <EmailAccountsClient organizationId={organizationId} initialAccounts={accounts} />;
  } catch (error) {
    console.error("[mail/accounts] load failed", error);
    return (
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-destructive">Mail</p>
          <h1 className="mt-2 text-2xl font-semibold">Email accounts unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The persisted mail store could not be loaded. Check PostgreSQL and retry.
          </p>
        </div>
      </main>
    );
  }
}
