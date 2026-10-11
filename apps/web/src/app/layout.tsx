import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationProvider } from "@/components/notifications";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";

export const metadata: Metadata = { title: "Clara Comms — AI communications", description: "Organization-owned multi-channel AI communications agent" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  // Middleware handles the fast unauthenticated redirect. This server-side
  // check is the authoritative application-identity boundary for page renders.
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
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/setup")) return <html lang="en"><body>{children}</body></html>;
  return <html lang="en"><body><NotificationProvider><div className="min-h-screen bg-background"><Sidebar /><div className="flex min-h-screen min-w-0 flex-col md:ml-[248px]"><TopBar /><div className="min-h-0 flex-1">{children}</div></div></div></NotificationProvider></body></html>;
}
