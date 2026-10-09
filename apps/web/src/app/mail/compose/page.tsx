import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { ComposeClient } from "./compose-client";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  if (!process.env.DATABASE_URL) return <State title="Compose unavailable" body="PostgreSQL is required for persisted drafts." />;
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  const organizationId = context?.organizationId;
  if (!organizationId) return <State title="Compose unavailable" body="The current organization could not be resolved." />;
  return <ComposeClient organizationId={organizationId} />;
}

function State({ title, body }: { title: string; body: string }) {
  return <main className="mx-auto min-h-full max-w-3xl bg-background p-5 sm:p-7 lg:p-10"><a href="/mail/inbox" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">← Back to inbox</a><div className="mt-6 rounded-md border border-border bg-card p-8"><p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Mail workspace</p><h1 className="mt-2 font-display text-2xl font-medium">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></div></main>;
}
