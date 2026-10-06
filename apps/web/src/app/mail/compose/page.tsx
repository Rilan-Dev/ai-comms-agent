import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { ComposeClient } from "./compose-client";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  if (!process.env.DATABASE_URL) return <State title="Compose unavailable" body="PostgreSQL is required for persisted drafts." />;
  await ensureDevSeed();
  const organizationId = getDevOrgId();
  if (!organizationId) return <State title="Compose unavailable" body="The current organization could not be resolved." />;
  return <ComposeClient organizationId={organizationId} />;
}

function State({ title, body }: { title: string; body: string }) {
  return <main className="mx-auto max-w-3xl p-6 lg:p-10"><a href="/mail/inbox" className="text-sm font-semibold text-muted-foreground">← Back to inbox</a><div className="mt-6 rounded-3xl border bg-background p-8 shadow-sm"><h1 className="text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p></div></main>;
}
