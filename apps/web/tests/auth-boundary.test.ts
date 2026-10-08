import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("production authentication boundary", () => {
  it("has a public login page and auth endpoints", () => {
    const login = read("src/app/login/page.tsx");
    expect(login).toContain("/api/auth/login");
    expect(login).not.toContain("\\\\n      router.replace");
    expect(read("src/app/api/auth/login/route.ts")).toContain("loginWithPassword");
    expect(read("src/app/api/auth/logout/route.ts")).toContain("aca-access-token");
    const auth = read("src/lib/identity/local-auth.ts");
    expect(auth).toContain("getMembershipsForUser(user.id)");
    expect(auth).toContain("AccountNotProvisionedError");
    expect(auth).toContain("throw new AccountNotProvisionedError()");
    expect(read("src/app/api/auth/login/route.ts")).toContain("status: 403");
  });

  it("redirects browser pages without an authentication cookie", () => {
    const middleware = read("src/middleware.ts");
    expect(middleware).toContain('request.cookies.get("aca-access-token")?.value');
    expect(middleware).toContain('new URL("/login", request.url)');
    expect(middleware).toContain('const PUBLIC_PATHS = ["/login", "/setup"');
    expect(middleware).toContain('if (pathname.startsWith("/api/"))');
  });

  it("keeps first-run setup public while protecting the application shell", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain('!pathname.startsWith("/login") && !pathname.startsWith("/setup")');
    expect(layout).toContain('pathname.startsWith("/login") || pathname.startsWith("/setup")');
  });

  it("treats owner as satisfying admin-level authorization guards", () => {
    const authorization = read("src/lib/identity/authorization.ts");
    expect(authorization).toContain('role === "owner" && roles.includes("admin")');
  });

  it("uses PostgreSQL-owned sessions for production identity resolution", () => {
    const adapter = read("src/lib/identity/local-auth.ts");
    expect(adapter).toContain("getActiveSession");
    expect(adapter).toContain("hashSessionToken");
    expect(adapter).toContain("status !== \"active\"");
    expect(adapter).not.toContain("SUPABASE_URL");
  });

  it("does not expose development identity headers from production UI clients", () => {
    expect(read("src/app/agents/agents-client.tsx")).not.toContain("x-dev-user-id");
    expect(read("src/app/agents/[id]/agent-detail-client.tsx")).not.toContain("x-dev-user-id");
  });

  it("selects the real adapter in production and keeps the dev adapter development-only", () => {
    const repository = read("src/lib/identity/repository.ts");
    expect(repository).toContain('process.env.NODE_ENV !== "production" && process.env.ACA_ENABLE_DEV_IDENTITY === "true"');
    expect(repository).toContain("new LocalIdentityAdapter");
    expect(repository).toContain("new DevIdentityAdapter");
  });
});
