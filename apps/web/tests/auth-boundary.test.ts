import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("production authentication boundary", () => {
  it("has a public login page and auth endpoints", () => {
    expect(read("src/app/login/page.tsx")).toContain("/api/auth/login");
    expect(read("src/app/api/auth/login/route.ts")).toContain("grant_type=password");
    expect(read("src/app/api/auth/logout/route.ts")).toContain("aca-access-token");
  });

  it("redirects browser pages without an authentication cookie", () => {
    const middleware = read("src/middleware.ts");
    expect(middleware).toContain('request.cookies.get("aca-access-token")?.value');
    expect(middleware).toContain('new URL("/login", request.url)');
    expect(middleware).toContain('if (pathname.startsWith("/api/"))');
  });

  it("uses Supabase Auth for production identity resolution", () => {
    const adapter = read("src/lib/identity/supabase-adapter.ts");
    expect(adapter).toContain("/auth/v1/user");
    expect(adapter).toContain("SUPABASE_URL");
    expect(adapter).toContain("SUPABASE_PUBLISHABLE_KEY");
    expect(adapter).toContain("getUserByEmail");
  });

  it("does not expose development identity headers from production UI clients", () => {
    expect(read("src/app/agents/agents-client.tsx")).not.toContain("x-dev-user-id");
    expect(read("src/app/agents/[id]/agent-detail-client.tsx")).not.toContain("x-dev-user-id");
  });

  it("selects the real adapter in production and keeps the dev adapter development-only", () => {
    const repository = read("src/lib/identity/repository.ts");
    expect(repository).toContain('process.env.NODE_ENV === "production"');
    expect(repository).toContain("new SupabaseIdentityAdapter");
    expect(repository).toContain("new DevIdentityAdapter");
  });
});
