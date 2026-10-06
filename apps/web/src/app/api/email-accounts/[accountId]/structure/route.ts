import { NextResponse } from "next/server";
import { PostgresAgentRepository, PostgresEmailAccountRepository, PostgresEmailFolderLabelRepository } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "database_not_configured", message: "PostgreSQL is required for mailbox structure." },
        { status: 503 },
      );
    }

    await ensureDevSeed();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    const { accountId } = await context.params;
    if (!organizationId || !accountId) {
      return NextResponse.json(
        { error: "validation_error", message: "Organization and account are required." },
        { status: 422 },
      );
    }

    await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const accounts = new PostgresEmailAccountRepository();
    const account = await accounts.getById(accountId);
    if (!account || account.organization_id !== organizationId) {
      return NextResponse.json({ error: "not_found", message: "Email account was not found." }, { status: 404 });
    }

    const repository = new PostgresEmailFolderLabelRepository();
    const agentRepository = new PostgresAgentRepository();
    const [folders, labels, agents] = await Promise.all([
      repository.listFolders(accountId),
      repository.listLabels(accountId),
      agentRepository.agentsForEmailAccount(organizationId, accountId),
    ]);

    return NextResponse.json({
      account: {
        id: account.id,
        provider: account.provider,
        email_address: account.email_address,
        status: account.status,
        capabilities: account.capabilities,
      },
      folders,
      labels,
      agents,
      discoveredAt: folders.map((folder) => folder.last_synced_at).filter(Boolean).sort().at(-1) ?? null,
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
