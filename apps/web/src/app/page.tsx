import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/top-bar";

export default function HomePage() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <h1 className="text-2xl font-bold mb-4">Overview</h1>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Active Agents</h2>
              <p className="mt-2 text-3xl font-bold">0</p>
              <p className="mt-1 text-xs text-muted-foreground">No agents created yet</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Email Accounts</h2>
              <p className="mt-2 text-3xl font-bold">0</p>
              <p className="mt-1 text-xs text-muted-foreground">No accounts connected</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">WhatsApp</h2>
              <p className="mt-2 text-3xl font-bold">—</p>
              <p className="mt-1 text-xs text-muted-foreground">Not connected</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Scheduled Jobs</h2>
              <p className="mt-2 text-3xl font-bold">0</p>
              <p className="mt-1 text-xs text-muted-foreground">No jobs scheduled</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">Today&apos;s Activity</h2>
              <p className="mt-2 text-3xl font-bold">0</p>
              <p className="mt-1 text-xs text-muted-foreground">No activity today</p>
            </div>
            <div className="rounded-lg border p-4">
              <h2 className="text-sm font-medium text-muted-foreground">System Status</h2>
              <p className="mt-2 text-sm font-medium text-green-600">Phase 2 — Foundation</p>
              <p className="mt-1 text-xs text-muted-foreground">Application boots. Awaiting Phase 3.</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
