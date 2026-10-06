const sections = [
  { href: "/settings/organization", title: "Organization", description: "Workspace identity, lifecycle and organization-level controls.", status: "Foundation" },
  { href: "/settings/members", title: "Members & roles", description: "Review membership, role boundaries and access controls.", status: "Foundation" },
  { href: "/settings/ai", title: "AI & providers", description: "Clara configuration, model routing and voice readiness.", status: "Configuration" },
  { href: "/settings/security", title: "Security", description: "Authorization, webhook boundaries, secrets and operational safeguards.", status: "Security" },
  { href: "/settings/notifications", title: "Notifications", description: "Delivery preferences for operational and agent events.", status: "Preferences" },
];

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-[1100px] space-y-8 p-5 sm:p-7 lg:p-9">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          A single control center for organization access, AI configuration and operational security.
          Configuration-required states are explicit; this page never presents fabricated provider readiness.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="group rounded-2xl border bg-background p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{section.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{section.description}</p>
              </div>
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{section.status}</span>
            </div>
            <div className="mt-5 flex items-center text-sm font-medium text-primary">
              Open settings <span className="ml-2 transition-transform group-hover:translate-x-1">→</span>
            </div>
          </a>
        ))}
      </section>

      <section className="rounded-2xl border bg-muted/30 p-5">
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Runtime posture</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Status label="Provider credentials" value="Server-side only" />
          <Status label="Sensitive actions" value="Approval controlled" />
          <Status label="Tenant isolation" value="Organization scoped" />
        </div>
      </section>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}
