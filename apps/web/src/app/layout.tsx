import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";
import { NotificationProvider } from "@/components/notifications";

export const metadata: Metadata = {
  title: "Clara Comms — AI communications",
  description: "Organization-owned multi-channel AI communications agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </div>
        </NotificationProvider>
      </body>
    </html>
  );
}
