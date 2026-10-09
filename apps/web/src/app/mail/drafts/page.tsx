import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import DraftsClient from "./drafts-client";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  if (!process.env.DATABASE_URL) {
    return (
      <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10">
        <div className="max-w-3xl rounded-md border border-border bg-card p-8">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Mail workspace</p>
          <h1 className="mt-2 font-display text-2xl font-medium">Drafts</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">PostgreSQL is required to load persisted drafts. No demo drafts are shown.</p>
        </div>
      </main>
    );
  }

  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  const organizationId = context?.organizationId;
  if (!organizationId) {
    return (
      <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10">
        <div className="max-w-3xl rounded-md border border-border bg-card p-8">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Mail workspace</p>
          <h1 className="mt-2 font-display text-2xl font-medium">Drafts</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">No organization context is available.</p>
        </div>
      </main>
    );
  }

  return <DraftsClient organizationId={organizationId} />;
}
