/**
 * Identity repository singleton for the web app.
 *
 * Phase 3: uses InMemoryIdentityRepository for local development.
 * Phase 4 will replace this with a Supabase-backed implementation.
 *
 * The repository is seeded with a development organization + user so the
 * authorization API can be tested locally.
 */

import { InMemoryIdentityRepository, PostgresIdentityRepository } from "@ai-comms-agent/db";
import type { IdentityRepository } from "@ai-comms-agent/db";
import { asUserId, asOrganizationId } from "@ai-comms-agent/shared";
import { DevIdentityAdapter } from "./dev-adapter";
import type { IdentityAdapter } from "@ai-comms-agent/shared";

// ============================================================================
// Singleton repository (in-memory for Phase 3)
// ============================================================================

let _repo: IdentityRepository | null = null;
let _identityAdapter: DevIdentityAdapter | null = null;
let _seeded = false;

export function getIdentityRepository(): IdentityRepository {
  if (!_repo) {
    _repo = process.env.DATABASE_URL
      ? new PostgresIdentityRepository()
      : InMemoryIdentityRepository.create();
  }
  return _repo;
}

export function getIdentityAdapter(): IdentityAdapter {
  if (!_identityAdapter) {
    _identityAdapter = new DevIdentityAdapter(getIdentityRepository());
  }
  return _identityAdapter;
}

/**
 * Seed development data. Idempotent. Only runs in non-production.
 * Creates a dev organization + dev user with owner role.
 */
export async function ensureDevSeed(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("ensureDevSeed MUST NOT be called in production.");
  }
  if (_seeded) return;
  _seeded = true;

  const repo = getIdentityRepository();

  if (process.env.DATABASE_URL) {
    const existingUser = await repo.getUserByEmail("dev@ai-comms-agent.local");
    const user = existingUser ?? await repo.createUser({
      email: "dev@ai-comms-agent.local",
      name: "Dev User",
    });

    const existingOrg = await repo.getOrganizationBySlug("dev-org");
    const org = existingOrg ?? (await repo.createOrganizationWithOwner({
      name: "Development Organization",
      slug: "dev-org",
      ownerId: user.id,
    })).organization;

    const membership = await repo.getMembership(org.id, user.id);
    if (!membership) {
      await repo.createMembership({ organizationId: org.id, userId: user.id, role: "owner" });
    }

    (globalThis as { __ACA_DEV_ORG_ID?: string }).__ACA_DEV_ORG_ID = org.id;
    (globalThis as { __ACA_DEV_USER_ID?: string }).__ACA_DEV_USER_ID = user.id;
    return;
  }

  const memoryRepo = repo as InMemoryIdentityRepository;
  const org = await memoryRepo.createOrganizationWithOwner({
    name: "Development Organization",
    slug: "dev-org",
    ownerId: undefined as never,
  }).catch(async () => {
    const createdOrg = await memoryRepo.createOrganization({ name: "Development Organization", slug: "dev-org" });
    const user = await memoryRepo.createUser({ email: "dev@ai-comms-agent.local", name: "Dev User" });
    await memoryRepo.createMembership({ organizationId: createdOrg.id, userId: user.id, role: "owner" });
    (globalThis as { __ACA_DEV_ORG_ID?: string }).__ACA_DEV_ORG_ID = createdOrg.id;
    (globalThis as { __ACA_DEV_USER_ID?: string }).__ACA_DEV_USER_ID = user.id;
    return createdOrg;
  });

  void org;
}

/**
 * Get the dev user ID (for development tooling only).
 */
export function getDevUserId(): string | undefined {
  return (globalThis as { __ACA_DEV_USER_ID?: string }).__ACA_DEV_USER_ID;
}

/**
 * Get the dev organization ID (for development tooling only).
 */
export function getDevOrgId(): string | undefined {
  return (globalThis as { __ACA_DEV_ORG_ID?: string }).__ACA_DEV_ORG_ID;
}
