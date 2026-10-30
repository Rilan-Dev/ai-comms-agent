import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Organization } from "@ai-comms-agent/shared";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationProvider } from "@/components/notifications";
import { getAuthenticatedAppContext, getIdentityRepository } from "@/lib/identity/repository";
import { resolveWorkspaceDisplayName, FALLBACK_WORKSPACE_NAME } from "@/lib/branding";

const BASE_DESCRIPTION = "Organization-owned multi-channel AI communications workspace";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  if (pathname.startsWith("/login") || pathname.startsWith("/setup")) {
    return { title: FALLBACK_WORKSPACE_NAME, description: BASE_DESCRIPTION };
  }
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("aca-access-token")?.value;
    const authHeaders = new Headers();
    if (accessToken) authHeaders.set("cookie", `aca-access-token=${encodeURIComponent(accessToken)}`);
    const request = new Request("http://localhost", { headers: authHeaders });
    const context = await getAuthenticatedAppContext(request);
    if (!context?.organizationId) return { title: FALLBACK_WORKSPACE_NAME, description: BASE_DESCRIPTION };
    const organization = await getIdentityRepository().getOrganizationById(context.organizationId);
    return { title: resolveWorkspaceDisplayName(organization), description: BASE_DESCRIPTION };
  } catch {
    return { title: FALLBACK_WORKSPACE_NAME, description: BASE_DESCRIPTION };
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  // Middleware handles the fast unauthenticated redirect. This server-side
  // check is the authoritative application-identity boundary for page renders.
  let organization: Organization | null = null;
  if (!pathname.startsWith("/login") && !pathname.startsWith("/setup")) {
    // Read the browser cookie explicitly. Next.js server-component header
    // snapshots can omit request-cookie state during an RSC navigation, while
    // the authentication boundary requires the exact browser session token.
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("aca-access-token")?.value;
    const authHeaders = new Headers();
    if (accessToken) authHeaders.set("cookie", `aca-access-token=${encodeURIComponent(accessToken)}`);
    const request = new Request("http://localhost", { headers: authHeaders });
    const context = await getAuthenticatedAppContext(request);
    if (!context) redirect("/login?reason=not_provisioned");
    if (context.organizationId) {
      organization = await getIdentityRepository().getOrganizationById(context.organizationId).catch(() => null);
    }
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/setup")) return <html lang="en" data-theme="dark" suppressHydrationWarning><body>{children}</body></html>;
  const workspaceName = resolveWorkspaceDisplayName(organization);
  return <html lang="en" data-theme="dark" suppressHydrationWarning><body><NotificationProvider><div className="min-h-screen bg-background"><Sidebar workspaceName={workspaceName} organizationName={organization?.name ?? null} /><div className="flex min-h-screen min-w-0 flex-col md:ml-[248px]"><TopBar workspaceName={workspaceName} organizationName={organization?.name ?? null} /><div className="min-h-0 flex-1">{children}</div></div></div></NotificationProvider></body></html>;
}
