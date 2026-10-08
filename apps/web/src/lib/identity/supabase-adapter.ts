import type { IdentityAdapter, User } from "@ai-comms-agent/shared";
import type { IdentityRepository } from "@ai-comms-agent/db";

const ACCESS_TOKEN_COOKIE = "aca-access-token";
const SUPABASE_USER_PATH = "/auth/v1/user";

/** Production authentication adapter backed by Supabase Auth. */
export class SupabaseIdentityAdapter implements IdentityAdapter {
  constructor(private readonly repo: IdentityRepository) {}

  async resolveUser(request: Request): Promise<User | null> {
    const token = parseCookie(request.headers.get("cookie"), ACCESS_TOKEN_COOKIE);
    if (!token) return null;

    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!supabaseUrl || !publishableKey) {
      throw new Error("Production authentication is not configured: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required.");
    }

    const response = await fetch(new URL(SUPABASE_USER_PATH, supabaseUrl), {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: publishableKey,
      },
      cache: "no-store",
    });
    if (!response.ok) return null;

    const authUser = (await response.json()) as { id?: string; email?: string; user_metadata?: { name?: string } };
    if (!authUser.email) return null;

    // Application identity remains authoritative: a valid IdP account without
    // an application user/membership must not enter the organization runtime.
    return repo.getUserByEmail(authUser.email);
  }
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export { ACCESS_TOKEN_COOKIE };
