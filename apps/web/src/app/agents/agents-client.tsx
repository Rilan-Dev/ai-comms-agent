"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications";
import { slugifyAgentName } from "@/lib/agents/validation";
import type { Agent } from "@ai-comms-agent/shared";

export function AgentsClient({ organizationId, devUserId, initialAgents }: { organizationId: string; devUserId: string; initialAgents: Agent[] }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [agents, setAgents] = useState(initialAgents);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const filtered = useMemo(() => agents.filter((a) => [a.name, a.slug, a.description ?? "", a.status].join(" ").toLowerCase().includes(query.toLowerCase())), [agents, query]);

  async function createAgent(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/agents", { method: "POST", headers: { "content-type": "application/json", "x-dev-user-id": devUserId }, body: JSON.stringify({ organizationId, name, slug: slug || slugifyAgentName(name), description }) });
      const payload = await response.json();
      if (!response.ok) {
        notify({ kind: "error", title: "Agent could not be created", message: payload.message ?? Object.values(payload.fieldErrors ?? {}).filter(Boolean).join(" ") });
        return;
      }
      setAgents((current) => [payload.agent, ...current]);
      notify({ kind: "success", title: "Agent created", message: "The draft agent is ready to configure." });
      router.push(\`/agents/\${payload.agent.id}\`);
    } finally { setCreating(false); }
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-7 p-5 sm:p-7 lg:p-9">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Agent workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your communications agents</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Build focused assistants, control their permissions, connect channels, and deploy versioned configurations.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => router.refresh()} className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-muted">Refresh</button><button type="button" onClick={() => document.getElementById("new-agent")?.scrollIntoView({ behavior: "smooth" })} className="h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">New agent</button></div>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">{[["Total", agents.length], ["Active", agents.filter((a) => a.status === "active").length], ["Drafts", agents.filter((a) => a.status === "draft").length]].map(([label, value]) => <div key={label as string} className="rounded-2xl border bg-background p-5 shadow-sm"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</section>
      <section className="rounded-3xl border bg-background shadow-sm">
        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Agents</h2><p className="text-xs text-muted-foreground">{filtered.length} matching records</p></div><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents…" className="h-10 w-full rounded-xl border bg-muted/30 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 sm:w-72" /></div>
        {filtered.length === 0 ? <div className="p-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted">✦</div><h3 className="mt-4 font-semibold">{agents.length ? "No agents match" : "Create your first agent"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{agents.length ? "Try a different search." : "Agents are persisted in PostgreSQL. Create one below to begin configuring channels, policy, and versions."}</p></div> : <div className="divide-y">{filtered.map((agent) => <button key={agent.id} type="button" onClick={() => router.push(\`/agents/\${agent.id}\`)} className="grid w-full gap-4 p-5 text-left transition hover:bg-muted/30 md:grid-cols-[1fr_auto_auto] md:items-center"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-foreground text-background">✦</div><div className="min-w-0"><p className="truncate font-semibold">{agent.name}</p><p className="truncate text-xs text-muted-foreground">{agent.slug} · {agent.description || "No description"}</p></div></div><span className={\`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold \${agent.status === "active" ? "bg-emerald-50 text-emerald-700" : agent.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}\`}>{agent.status}</span><span className="text-xs font-medium text-primary">Configure →</span></button>)}</div>}
      </section>
      <section id="new-agent" className="rounded-3xl border bg-background p-5 shadow-sm sm:p-7"><div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Create</p><h2 className="mt-2 text-xl font-semibold">Start a new agent</h2><p className="mt-1 text-sm text-muted-foreground">The first version and policy are created transactionally with the agent.</p></div><form onSubmit={createAgent} className="mt-6 grid gap-4 lg:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Name<input required value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugifyAgentName(e.target.value)); }} className="mt-1 h-11 w-full rounded-xl border px-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" placeholder="Operations Assistant" /></label><label className="space-y-1.5 text-sm font-medium">Slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="mt-1 h-11 w-full rounded-xl border px-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" placeholder="operations-assistant" /></label><label className="space-y-1.5 text-sm font-medium lg:col-span-2">Purpose<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-xl border px-3 py-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" placeholder="What should this agent help your organization accomplish?" /></label><div className="lg:col-span-2"><button disabled={creating} className="h-11 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">{creating ? "Creating…" : "Create agent"}</button></div></form></section>
    </main>
  );
}
