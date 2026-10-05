import { NextResponse } from "next/server";
import { PostgresAgentRepository } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { validateAgentInput } from "@/lib/agents/validation";

export const dynamic = "force-dynamic";

function dbRequired() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "database_not_configured", message: "PostgreSQL is required for persisted agents." },
      { status: 503 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const missingDb = dbRequired();
    if (missingDb) return missingDb;
    await ensureDevSeed();
    const orgId = new URL(request.url).searchParams.get("organizationId");
    if (!orgId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });

    await authorize(request, { organizationId: asOrganizationId(orgId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const agents = await new PostgresAgentRepository().list(orgId);
    return NextResponse.json({ agents });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const missingDb = dbRequired();
    if (missingDb) return missingDb;
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });

    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const validation = validateAgentInput(body ?? {});
    if (!validation.ok) return NextResponse.json({ error: "validation_error", fieldErrors: validation.fieldErrors }, { status: 422 });

    try {
      const agent = await new PostgresAgentRepository().create({
        organizationId,
        userId: subject.user.id,
        ...validation.value,
      });
      return NextResponse.json({ agent }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && /agents_org_slug_uniq|duplicate key/i.test(error.message)) {
        return NextResponse.json({ error: "conflict", fieldErrors: { slug: "An agent with this slug already exists." } }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
