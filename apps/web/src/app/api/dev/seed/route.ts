/**
 * POST /api/dev/seed
 *
 * DEVELOPMENT-ONLY endpoint that seeds a dev organization + user.
 * Returns the dev user ID and org ID for testing.
 *
 * This endpoint throws in production (DevIdentityAdapter throws).
 * Per Phase 3 handoff §16: clearly development-only.
 */

import { NextResponse } from "next/server";
import { ensureDevSeed, getDevUserId, getDevOrgId } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Development endpoints are not available in production." },
      { status: 403 },
    );
  }

  await ensureDevSeed();

  return NextResponse.json({
    message: "Development data seeded.",
    dev_user_id: getDevUserId(),
    dev_org_id: getDevOrgId(),
    instructions:
      "Use the dev_user_id as the x-dev-user-id header to authenticate as the dev user. " +
      "This is NOT real authentication — development only.",
  });
}
