import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@ai-comms-agent/db";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  // Verify Clara integration boundary exists (structural check)
  // Check multiple possible locations (pnpm puts symlinks in consuming package's node_modules)
  const possibleClaraPaths = [
    "node_modules/@ai-comms-agent/clara-core", // local to this package
    "../../node_modules/@ai-comms-agent/clara-core", // root (fallback)
  ];
  const claraCorePkg = possibleClaraPaths.some((p) => existsSync(resolve(p)));

  const possibleSourcePaths = [
    "../../packages/clara-core/src/runtime.ts", // from monorepo root
    "../../../packages/clara-core/src/runtime.ts", // deeper fallback
  ];
  const claraRuntimeSrc = possibleSourcePaths.some((p) => existsSync(resolve(p)));

  const possibleVendorPaths = [
    "../../vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime.ts",
    "../../../vendor/clara/clara-core/source/src/modules/ai-platform-core/clara-runtime.ts",
  ];
  const vendoredClara = possibleVendorPaths.some((p) => existsSync(resolve(p)));

  const checks = {
    web_app: "ok" as const,
    shared_package: "ok" as const,
    db_package: "ok" as const,
    clara_core_package: claraCorePkg ? ("ok" as const) : ("missing" as const),
    clara_core_source: claraRuntimeSrc ? ("ok" as const) : ("missing" as const),
    vendored_clara_source: vendoredClara ? ("ok" as const) : ("missing" as const),
    supabase_configured: isSupabaseConfigured(),
    environment: process.env.NODE_ENV ?? "development",
    timestamp: new Date().toISOString(),
  };

  const allOk = checks.clara_core_package === "ok" && checks.vendored_clara_source === "ok";
  const status = allOk ? 200 : 503;

  return NextResponse.json(
    {
      status: status === 200 ? "healthy" : "unhealthy",
      checks,
    },
    { status },
  );
}
