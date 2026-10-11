/**
 * DEVELOPMENT-ONLY IDENTITY STUB
 *
 * ⚠️⚠️⚠️ THIS IS NOT REAL AUTHENTICATION ⚠️⚠️⚠️
 *
 * This file provides a development-only identity adapter for local testing
 * and UI development. It is:
 *   - NOT secure
 *   - NOT for production
 *   - Impossible to mistake for production security (throws in production)
 *
 * Per Phase 3 handoff §16: "If a development identity stub is necessary for
 * UI testing, it must be clearly development-only and impossible to mistake
 * for production security."
 *
 * Per Phase 3 handoff §22: "insecure development authentication accidentally
 * enabled in production" is a security review check.
 *
 * PRODUCTION GUARD: This adapter throws an error if NODE_ENV is "production".
 * It is structurally impossible to use this in production.
 *
 * The development stub reads a user ID from the `x-dev-user-id` header.
 * This is NOT a security boundary — it's a convenience for local development.
 * The header is not trusted in production (the adapter throws before reading it).
 *
 * Production authentication is implemented by the PostgreSQL-backed local session
 * adapter. This development stub remains only for explicit local UI testing.
 */

import type { IdentityAdapter, User, UserId } from "@ai-comms-agent/shared";
import { asUserId } from "@ai-comms-agent/shared";
import type { IdentityRepository } from "@ai-comms-agent/db";

const DEV_USER_HEADER = "x-dev-user-id";

export class DevIdentityAdapter implements IdentityAdapter {
  constructor(private readonly repo: IdentityRepository) {}

  async resolveUser(request: Request): Promise<User | null> {
    // ============================================================
    // PRODUCTION GUARD — structurally impossible to bypass
    // ============================================================
    if (process.env.NODE_ENV === "production" && process.env.ACA_ENABLE_DEV_IDENTITY !== "true") {
      throw new Error(
        "DevIdentityAdapter MUST NOT be used in production. " +
          "This is a development-only identity stub. " +
          "Configure a real IdentityAdapter for production.",
      );
    }

    // ============================================================
    // DEVELOPMENT-ONLY: read dev user ID from header
    // ============================================================
    const devUserId = request.headers.get(DEV_USER_HEADER);
    if (!devUserId) {
      return null; // Unauthenticated (development)
    }

    const user = await this.repo.getUserById(asUserId(devUserId));
    if (!user) {
      return null;
    }

    return user;
  }
}

/**
 * Seed a development user for local testing.
 * Returns the created user. Idempotent — if the user already exists, returns it.
 *
 * This function is ONLY called from dev tooling, never from production code.
 */
export async function seedDevUser(
  repo: IdentityRepository,
  input: { email: string; name?: string },
): Promise<User> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seedDevUser MUST NOT be called in production.");
  }

  const existing = await repo.getUserByEmail(input.email);
  if (existing) return existing;

  return repo.createUser(input);
}
