import { getAuthenticatedAppContext } from "@/lib/identity/repository";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ApprovalsClient } from "./approvals-client";

export const dynamic = "force-dynamic";

export default async function MailApprovalsPage() {
  if (!process.env.DATABASE_URL) return <main className="p-8"><h1 className="text-2xl font-semibold">Approvals unavailable</h1><p className="mt-2 text-sm text-muted-foreground">PostgreSQL is required.</p></main>;
  const context = await getAuthenticatedAppContext(new Request("http://localhost", { headers: await headers() }));
  if (!context) redirect("/login?reason=not_provisioned");
  return <ApprovalsClient organizationId={context.organizationId} />;
}
