import { NextResponse } from "next/server";
import { query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

type KnowledgeStats = {
  email_documents: number;
  email_chunks: number;
  email_ready: number;
  email_pending: number;
  email_failed: number;
  external_documents: number;
  last_indexed_at: string | null;
};

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({
        error: "database_not_configured",
        message: "PostgreSQL is required to load Clara knowledge status.",
      }, { status: 503 });
    }

    const authenticated = await getIdentityAdapter().resolveUser(request);
    const memberships = authenticated
      ? await getIdentityRepository().getMembershipsForUser(authenticated.id)
      : [];
    const url = new URL(request.url);
    const requestedOrganizationId = url.searchParams.get("organizationId")?.trim();
    const organizationId = requestedOrganizationId
      || memberships.find((membership) => membership.status === "active")?.organizationId;

    if (!organizationId) {
      return NextResponse.json({
        error: "configuration_required",
        message: "Choose an organization before viewing knowledge status.",
      }, { status: 422 });
    }

    await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const [stats, recent] = await Promise.all([
      query<KnowledgeStats>(
        `SELECT
           COUNT(*) FILTER (WHERE storage_bucket='email-account')::int AS email_documents,
           (SELECT COUNT(*)::int FROM knowledge_chunks kc WHERE kc.organization_id=$1
             AND EXISTS (SELECT 1 FROM knowledge_documents kd WHERE kd.id=kc.document_id
               AND kd.organization_id=$1 AND kd.storage_bucket='email-account')) AS email_chunks,
           COUNT(*) FILTER (WHERE storage_bucket='email-account' AND status='ready')::int AS email_ready,
           COUNT(*) FILTER (WHERE storage_bucket='email-account' AND status='pending')::int AS email_pending,
           COUNT(*) FILTER (WHERE storage_bucket='email-account' AND status IN ('error','failed'))::int AS email_failed,
           COUNT(*) FILTER (WHERE storage_bucket IS DISTINCT FROM 'email-account')::int AS external_documents,
           MAX(updated_at) FILTER (WHERE storage_bucket='email-account' AND status='ready') AS last_indexed_at
         FROM knowledge_documents
         WHERE organization_id=$1`,
        [organizationId],
      ),
      query<{
        id: string;
        filename: string;
        status: string;
        updated_at: string;
        metadata: Record<string, unknown> | null;
      }>(
        `SELECT id, filename, status, updated_at, metadata
         FROM knowledge_documents
         WHERE organization_id=$1 AND storage_bucket='email-account'
         ORDER BY updated_at DESC
         LIMIT 8`,
        [organizationId],
      ),
    ]);

    const row = stats.rows[0];
    return NextResponse.json({
      organizationId,
      stats: {
        emailDocuments: Number(row?.email_documents ?? 0),
        emailChunks: Number(row?.email_chunks ?? 0),
        emailReady: Number(row?.email_ready ?? 0),
        emailPending: Number(row?.email_pending ?? 0),
        emailFailed: Number(row?.email_failed ?? 0),
        externalDocuments: Number(row?.external_documents ?? 0),
        lastIndexedAt: row?.last_indexed_at ?? null,
      },
      recentDocuments: recent.rows.map((document) => ({
        id: document.id,
        filename: document.filename,
        status: document.status,
        updatedAt: document.updated_at,
        provider: typeof document.metadata?.provider === "string" ? document.metadata.provider : null,
        receivedAt: typeof document.metadata?.received_at === "string" ? document.metadata.received_at : null,
      })),
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
