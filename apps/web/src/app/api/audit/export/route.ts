import { NextResponse } from "next/server";
import { listOrganizationAuditEventsForExport } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getDevOrgId, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for audit export." }, { status: 503 });
    }
    await ensureDevSeed();
    const url = new URL(request.url);
    const rawId = url.searchParams.get("organizationId")?.trim() || getDevOrgId();
    if (!rawId) return NextResponse.json({ error: "configuration_required", message: "An organization context is required." }, { status: 422 });

    await authorize(request, { organizationId: asOrganizationId(rawId), permission: "audit.read" }, getIdentityAdapter(), getIdentityRepository());

    const filters = {
      eventType: url.searchParams.get("eventType")?.trim() || undefined,
      decision: url.searchParams.get("decision")?.trim() || undefined,
      actorUserId: url.searchParams.get("actorUserId")?.trim() || undefined,
      search: url.searchParams.get("search")?.trim() || undefined,
      from: url.searchParams.get("from")?.trim() || undefined,
      to: url.searchParams.get("to")?.trim() || undefined,
    };
    const events = await listOrganizationAuditEventsForExport(rawId, filters);
    const format = (url.searchParams.get("format") || "json").toLowerCase();

    if (format === "csv") {
      const header = ["id","createdAt","eventType","targetType","targetId","action","decision","actorUserId","agentId","metadata"];
      const rows = events.map((event) => [
        event.id,event.createdAt,event.eventType,event.targetType,event.targetId,event.action,
        event.decision,event.actorUserId,event.agentId,event.metadata,
      ].map(csvCell).join(","));
      return new Response([header.join(","), ...rows, ""].join("\r\n"), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-export.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), organizationId: rawId, count: events.length, events }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-export.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
