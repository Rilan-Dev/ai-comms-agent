import { createFileRoute } from "@tanstack/react-router";
import { CircleDashed, MessageCircle, ShieldCheck } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";

export const Route = createFileRoute("/settings/connections")({
  head: () => ({ meta: [{ title: "Connections | Comms Agent" }] }),
  component: ConnectionsPage,
});

const providers = [
  { name: "Google Gmail", detail: "OAuth 2.0 · Gmail API", description: "Read, organize, summarize, and draft replies for a Google mailbox." },
  { name: "Zoho Mail", detail: "OAuth 2.0 · Zoho Mail API", description: "Connect a Zoho mailbox using organization-scoped OAuth credentials." },
  { name: "Microsoft 365", detail: "Microsoft Graph · planned adapter", description: "Provider contract retained from the source architecture; runtime integration is not yet migrated." },
  { name: "IMAP / SMTP", detail: "Encrypted mailbox credentials", description: "Connect other providers for mailbox reading and sending." },
];

function ConnectionsPage() {
  return (
    <WorkspaceShell title="Connections" subtitle="Bring your communication channels into one workspace.">
      <section className="mb-8 rounded-lg border border-border bg-card p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck size={22} className="mt-1 text-muted-foreground" />
          <div>
            <h2 className="text-base font-semibold">Secure, workspace-scoped connections</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Provider flows are being adapted from the source application. A mailbox will not be
              reported as connected until authorization, encrypted credential storage, and provider
              callbacks are implemented and confirmed by the server.
            </p>
        </div>
      </section>
      <section aria-labelledby="email-heading">
        <div className="mb-4">
          <h2 id="email-heading" className="text-base font-semibold">Email accounts</h2>
          <p className="mt-1 text-xs text-muted-foreground">Multiple mailboxes per agent are supported by the source architecture.</p>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-card">
          {providers.map((provider) => (
            <article key={provider.name} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">{provider.name}</h3>
                  <span className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground">
                    <CircleDashed size={11} /> Not connected
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{provider.description}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">{provider.detail}</p>
              </div>
              <span className="shrink-0 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
                Connection unavailable
              </span>
            </article>
          ))}
        </div>
      </section>
      <section className="mt-9" aria-labelledby="messaging-heading">
        <h2 id="messaging-heading" className="mb-4 text-base font-semibold">Messaging channels</h2>
        <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center">
          <MessageCircle size={22} className="text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">WhatsApp Business</h3>
              <span className="rounded bg-secondary px-2 py-1 text-[10px] text-muted-foreground">Not connected</span>
            </div>
            <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
              One WhatsApp Business connection per agent, with inbound replies and scheduled summary delivery planned.
            </p>
          </div>
          <span className="shrink-0 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">Connection unavailable</span>
        </article>
      </section>
      <section className="mt-9 rounded-lg border border-dashed border-border p-5">
        <h2 className="text-sm font-semibold">Next migration slice</h2>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Establish database configuration, tenant authorization, encrypted credentials, and provider-neutral account contracts before enabling OAuth or mailbox actions.
        </p>
      </section>
    </WorkspaceShell>
  );
}
