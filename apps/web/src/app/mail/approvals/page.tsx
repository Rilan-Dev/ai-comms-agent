import { ensureDevSeed, getDevOrgId } from "@/lib/identity/repository";
import { ApprovalsClient } from "./approvals-client";

export const dynamic = "force-dynamic";

export default async function MailApprovalsPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Approvals unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required.</p></main>;
  await ensureDevSeed();
  const organizationId = getDevOrgId();
  if (!organizationId) return <main className="p-8"><h1 className="text-2xl font-semibold">Approvals unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Organization context is unavailable.</p></main>;
  return <ApprovalsClient organizationId={organizationId} />;
}
