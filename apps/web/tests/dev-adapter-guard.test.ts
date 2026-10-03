/**
 * DevIdentityAdapter production guard tests.
 *
 * Per Phase 3 handoff §16: "clearly development-only and impossible to mistake
 * for production security."
 * Per Phase 3 handoff §22: "insecure development authentication accidentally
 * enabled in production" is a security review check.
 *
 * These tests verify that the DevIdentityAdapter:
 *   - Works in non-production (development/test)
 *   - Throws in production (structurally impossible to use)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { InMemoryIdentityRepository } from "@ai-comms-agent/db";
import { DevIdentityAdapter, seedDevUser } from "@/lib/identity/dev-adapter";

describe("DevIdentityAdapter production guard", () => {
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    (process.env as { NODE_ENV: string }).NODE_ENV = originalNodeEnv ?? "development";
  });

  function setNodeEnv(value: string): void {
    (process.env as { NODE_ENV: string }).NODE_ENV = value;
  }

  it("works in development (NODE_ENV !== production)", async () => {
    setNodeEnv("development");
    const repo = InMemoryIdentityRepository.create();
    const adapter = new DevIdentityAdapter(repo);
    const user = await repo.createUser({ email: "dev@test.local" });

    const request = new Request("http://localhost/api/test", {
      headers: { "x-dev-user-id": user.id },
    });
    const resolved = await adapter.resolveUser(request);
    expect(resolved).not.toBeNull();
    expect(resolved?.id).toBe(user.id);
  });

  it("throws in production (structurally impossible to use)", async () => {
    setNodeEnv("production");
    const repo = InMemoryIdentityRepository.create();
    const adapter = new DevIdentityAdapter(repo);

    const request = new Request("http://localhost/api/test", {
      headers: { "x-dev-user-id": "any-id" },
    });
    await expect(adapter.resolveUser(request)).rejects.toThrow(/MUST NOT be used in production/);
  });

  it("seedDevUser throws in production", async () => {
    setNodeEnv("production");
    const repo = InMemoryIdentityRepository.create();
    await expect(seedDevUser(repo, { email: "dev@test.local" })).rejects.toThrow(
      /MUST NOT be called in production/,
    );
  });

  it("returns null for unauthenticated requests in development (no header)", async () => {
    setNodeEnv("development");
    const repo = InMemoryIdentityRepository.create();
    const adapter = new DevIdentityAdapter(repo);

    const request = new Request("http://localhost/api/test");
    const resolved = await adapter.resolveUser(request);
    expect(resolved).toBeNull();
  });

  it("returns null for unknown user ID in development", async () => {
    setNodeEnv("development");
    const repo = InMemoryIdentityRepository.create();
    const adapter = new DevIdentityAdapter(repo);

    const request = new Request("http://localhost/api/test", {
      headers: { "x-dev-user-id": "nonexistent" },
    });
    const resolved = await adapter.resolveUser(request);
    expect(resolved).toBeNull();
  });
});
