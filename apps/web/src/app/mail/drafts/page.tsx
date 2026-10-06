import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import DraftsClient from "./drafts-client";

export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Drafts</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required to load persisted drafts.</p></main>;
  await ensureDevSeed();
  const organizationId = getDevOrgId();
  if (!organizationId) return <main className="p-8"><h1 className="text-2xl font-semibold">Drafts</h1><p className="mt-2 text-sm text-muted-foreground">No organization context is available.</p></main>;
  return <DraftsClient organizationId={organizationId} />;
}
