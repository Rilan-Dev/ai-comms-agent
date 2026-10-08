import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationProvider } from "@/components/notifications";
import { getAuthenticatedAppContext } from "@/lib/identity/repository";

export const metadata: Metadata = { title: "Clara Comms — AI communications", description: "Organization-owned multi-channel AI communications agent" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  // Middleware handles the fast unauthenticated redirect. This server-side
  // check is the authoritative application-identity boundary for page renders.
  if (!pathname.startsWith("/login") && !pathname.startsWith("/setup")) {
    const requestHeaders = await headers();
    const request = new Request("http://localhost", { headers: requestHeaders });
    const context = await getAuthenticatedAppContext(request);
    if (!context) redirect("/login?reason=not_provisioned");
  }

  if (pathname.startsWith("/login") || pathname.startsWith("/setup")) return <html lang="en"><body>{children}</body></html>;
  return <html lang="en"><body><NotificationProvider><div className="flex min-h-screen bg-background"><Sidebar /><div className="flex min-w-0 flex-1 flex-col"><TopBar /><div className="min-h-0 flex-1">{children}</div></div></div></NotificationProvider></body></html>;
}
