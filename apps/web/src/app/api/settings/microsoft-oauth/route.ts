import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { getOAuthRedirectUri } from "@/lib/oauth/redirect-uri";

export const dynamic = "force-dynamic";

const validTenant = (value: string) => value === "common" || value === "organizations" ||
  value === "consumers" || /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);

async function requireAdmin(request: Request, organizationId: string) {
  return authorize(request, { organizationId: asOrganizationId(organizationId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
}

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 422 });
    await requireAdmin(request, organizationId);
    const result = await query<Record<string, unknown>>(
      "SELECT id,label,client_id,tenant_id,enabled,created_at,updated_at FROM microsoft_oauth_configs WHERE organization_id=$1 ORDER BY created_at DESC",
      [organizationId],
    );
    return NextResponse.json({ configurations: result.rows.map((row) => ({
      id: String(row.id), label: String(row.label), clientId: String(row.client_id),
      tenantId: String(row.tenant_id), enabled: row.enabled === true,
      redirectUri: getOAuthRedirectUri(request, "microsoft"), secretConfigured: true,
      createdAt: row.created_at, updatedAt: row.updated_at,
    })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const label = typeof body?.label === "string" ? body.label.trim().slice(0, 100) : "";
    const clientId = typeof body?.clientId === "string" ? body.clientId.trim().slice(0, 500) : "";
    const tenantId = typeof body?.tenantId === "string" ? body.tenantId.trim() : "common";
    const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
    const enabled = body?.enabled !== false;
    if (!organizationId || !label || !clientId || !validTenant(tenantId) || (!id && !clientSecret)) {
      return NextResponse.json({ error: "validation_error", message: "Organization, label, client ID, valid Microsoft tenant and a secret for new clients are required." }, { status: 422 });
    }
    const subject = await requireAdmin(request, organizationId);
    const raw = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!raw) return NextResponse.json({ error: "platform_key_required", message: "The platform encryption key is required. Microsoft client settings themselves are saved here, not in environment variables." }, { status: 503 });
    const key = parseCredentialsMasterKey(raw);
    if (id) {
      const current = await query<{ client_id: string }>(
        "SELECT client_id FROM microsoft_oauth_configs WHERE id=$1 AND organization_id=$2",
        [id, organizationId],
      );
      if (!current.rows[0]) return NextResponse.json({ error: "not_found", message: "Microsoft OAuth client not found." }, { status: 404 });
      if (!clientSecret && current.rows[0].client_id !== clientId) return NextResponse.json({
        error: "validation_error", message: "Supply the new client secret when changing the Microsoft OAuth client ID.",
      }, { status: 422 });
      if (clientSecret) {
        await query(
          "UPDATE microsoft_oauth_configs SET label=$1, client_id=$2, tenant_id=$3, client_secret_ciphertext=$4, enabled=$5, updated_at=now() WHERE id=$6 AND organization_id=$7",
          [label, clientId, tenantId, encryptCredential(clientSecret, key), enabled, id, organizationId],
        );
      } else {
        await query(
          "UPDATE microsoft_oauth_configs SET label=$1, client_id=$2, tenant_id=$3, enabled=$4, updated_at=now() WHERE id=$5 AND organization_id=$6",
          [label, clientId, tenantId, enabled, id, organizationId],
        );
      }
    } else {
      await query(
        "INSERT INTO microsoft_oauth_configs (id,organization_id,label,client_id,tenant_id,client_secret_ciphertext,enabled,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [randomUUID(), organizationId, label, clientId, tenantId, encryptCredential(clientSecret, key), enabled, subject.user.id],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!organizationId || !id) return NextResponse.json({ error: "validation_error", message: "Organization and client ID are required." }, { status: 422 });
    await requireAdmin(request, organizationId);
    const result = await query(
      "DELETE FROM microsoft_oauth_configs WHERE id=$1 AND organization_id=$2 RETURNING id",
      [id, organizationId],
    );
    if (!result.rows.length) return NextResponse.json({ error: "not_found", message: "Microsoft OAuth client not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return authorizationErrorToResponse(error); }
}
