import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { encryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function masterKey() {
  const raw = process.env.CREDENTIALS_MASTER_KEY;
  return raw ? parseCredentialsMasterKey(raw) : null;
}

function redirectUri(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const base = configured ? new URL(configured) : new URL(request.url);
  return new URL("/api/oauth/gmail/callback", base).toString();
}

async function requireAdmin(request: Request, organizationId: string) {
  return authorize(request, { organizationId: asOrganizationId(organizationId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
}

export async function GET(request: Request) {
  try {
    const organizationId = new URL(request.url).searchParams.get("organizationId")?.trim() ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 422 });
    await requireAdmin(request, organizationId);
    const result = await query<Record<string, unknown>>(
      `SELECT id, label, client_id, redirect_uri, enabled, created_at, updated_at
       FROM gmail_oauth_configs WHERE organization_id = $1 ORDER BY created_at DESC`,
      [organizationId],
    );
    return NextResponse.json({
      configurations: result.rows.map((row) => ({
        id: String(row.id), label: String(row.label), clientId: String(row.client_id),
        redirectUri: String(row.redirect_uri), enabled: row.enabled === true,
        createdAt: row.created_at, updatedAt: row.updated_at, secretConfigured: true,
      })),
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    const label = typeof body?.label === "string" ? body.label.trim().slice(0, 100) : "";
    const clientId = typeof body?.clientId === "string" ? body.clientId.trim().slice(0, 500) : "";
    const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";
    const enabled = body?.enabled !== false;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!organizationId || !label || !clientId || (!clientSecret && !id)) {
      return NextResponse.json({ error: "validation_error", message: "Organization, label, client ID, and (for new configurations) client secret are required." }, { status: 422 });
    }
    const subject = await requireAdmin(request, organizationId);
    const key = masterKey();
    if (!key) return NextResponse.json({ error: "provider_configuration_required", message: "CREDENTIALS_MASTER_KEY is required to encrypt OAuth client secrets. Configure this platform encryption key on the server; OAuth client settings themselves are managed here." }, { status: 503 });

    if (id) {
      const existing = await query<Record<string, unknown>>(
        "SELECT id FROM gmail_oauth_configs WHERE id = $1 AND organization_id = $2",
        [id, organizationId],
      );
      if (!existing.rows[0]) return NextResponse.json({ error: "not_found", message: "OAuth configuration was not found." }, { status: 404 });
      if (clientSecret) {
        const ciphertext = encryptCredential(clientSecret, key);
        await query(
          `UPDATE gmail_oauth_configs SET label=$1, client_id=$2, client_secret_ciphertext=$3,
             redirect_uri=$4, enabled=$5, updated_at=now()
           WHERE id=$6 AND organization_id=$7`,
          [label, clientId, ciphertext, redirectUri(request), enabled, id, organizationId],
        );
      } else {
        await query(
          `UPDATE gmail_oauth_configs SET label=$1, client_id=$2, redirect_uri=$3,
             enabled=$4, updated_at=now()
           WHERE id=$5 AND organization_id=$6`,
          [label, clientId, redirectUri(request), enabled, id, organizationId],
        );
      }
    } else {
      const ciphertext = encryptCredential(clientSecret, key);
      await query(
        `INSERT INTO gmail_oauth_configs
           (id, organization_id, label, client_id, client_secret_ciphertext, redirect_uri, enabled, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [randomUUID(), organizationId, label, clientId, ciphertext, redirectUri(request), enabled, subject.user.id],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!organizationId || !id) return NextResponse.json({ error: "validation_error", message: "Organization and configuration ID are required." }, { status: 422 });
    await requireAdmin(request, organizationId);
    const result = await query(
      "DELETE FROM gmail_oauth_configs WHERE id = $1 AND organization_id = $2 RETURNING id",
      [id, organizationId],
    );
    if (!result.rows.length) return NextResponse.json({ error: "not_found", message: "OAuth configuration was not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

