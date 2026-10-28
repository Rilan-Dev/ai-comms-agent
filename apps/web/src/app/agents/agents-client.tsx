"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications";
import { slugifyAgentName, nextAgentSlug } from "@/lib/agents/validation";
import type { Agent } from "@ai-comms-agent/shared";

function AgentMark({ className = "size-5" }: { className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14z"/></svg>;
}

export function AgentsClient({ organizationId, initialAgents }: { organizationId: string; initialAgents: Agent[] }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [agents, setAgents] = useState(initialAgents);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Agent["status"] | "all">("all");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugCustomized, setSlugCustomized] = useState(false);
  const [description, setDescription] = useState("");
  const filtered = useMemo(() => agents.filter((a) => (status === "all" || a.status === status) && [a.name, a.slug, a.description ?? "", a.status].join(" ").toLowerCase().includes(query.toLowerCase())), [agents, query, status]);

  async function createAgent(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, name, slug: slug || slugifyAgentName(name), description }) });
      const payload = await response.json();
      if (!response.ok) {
        notify({ kind: "error", title: "Agent could not be created", message: payload.message ?? Object.values(payload.fieldErrors ?? {}).filter(Boolean).join(" ") });
        return;
      }
      setAgents((current) => [payload.agent, ...current]);
      notify({ kind: "success", title: "Agent created", message: "The draft agent is ready to configure." });
      router.push(`/agents/${payload.agent.id}`);
    } catch (error) {
      notify({ kind: "error", title: "Agent could not be created", message: error instanceof Error ? error.message : "Unable to reach the agent service." });
    } finally { setCreating(false); }
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><span className="grid size-7 place-items-center rounded bg-accent text-accent-foreground"><AgentMark className="size-4"/></span> Agent workspace</div><h1 className="font-display text-3xl font-medium tracking-tight sm:text-4xl">Your communications agents<span className="text-tertiary">.</span></h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Build focused assistants, control their permissions, connect channels, and deploy versioned configurations.</p></div>
        <div className="flex gap-2"><button type="button" onClick={() => router.refresh()} className="h-10 rounded-md border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-secondary">Refresh</button><button type="button" onClick={() => {const details=document.getElementById("new-agent") as HTMLDetailsElement|null;if(details){details.open=true;details.scrollIntoView({behavior:"smooth"});details.querySelector<HTMLInputElement>('input')?.focus({preventScroll:true});}}} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85">New agent</button></div>
      </header>
      <section className="grid grid-cols-1 gap-5 border-y border-border py-7 sm:grid-cols-3 sm:gap-8">{[["Total", agents.length], ["Active", agents.filter((a) => a.status === "active").length], ["Drafts", agents.filter((a) => a.status === "draft").length]].map(([label, value]) => <div key={label as string} className="min-w-0"><p className="flex items-center gap-2 text-xs text-muted-foreground"><span className="size-1.5 rounded-full bg-primary/50"/>{label} agents</p><p className="mt-3 font-display text-3xl font-medium leading-none">{value}</p><p className="mt-2 text-[11px] text-muted-foreground">{label === "Active" ? "Marked active" : label === "Drafts" ? "Still being configured" : "Persisted in your workspace"}</p></div>)}</section>
      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h2 className="font-semibold">Agents</h2><p className="text-xs text-muted-foreground">{filtered.length} matching records</p></div><div className="flex w-full gap-2 sm:w-auto"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents…" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20 sm:w-64" /><select value={status} onChange={(e) => setStatus(e.target.value as Agent["status"] | "all")} aria-label="Filter agents by status" className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All status</option><option value="active">Active</option><option value="draft">Draft</option><option value="paused">Paused</option><option value="archived">Archived</option></select></div></div>
        {filtered.length === 0 ? <div className="p-12 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-accent/60 text-accent-foreground"><AgentMark className="size-5" /></div><h3 className="mt-4 font-semibold">{agents.length ? "No agents match" : "Create your first agent"}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{agents.length ? "Try a different search." : "Create an agent to get started with your communications."}</p></div> : <div className="divide-y divide-border">{filtered.map((agent) => <button key={agent.id} type="button" onClick={() => router.push(`/agents/${agent.id}`)} className="grid w-full gap-4 p-4 text-left transition-colors hover:bg-secondary/60 sm:p-5 md:grid-cols-[1fr_auto_auto] md:items-center"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><AgentMark className="size-5" /></div><div className="min-w-0"><p className="truncate font-semibold">{agent.name}</p><p className="truncate text-xs text-muted-foreground">{agent.slug} · {agent.description || "No description"}</p></div></div><span className={`w-fit rounded-sm px-2 py-1 text-[10px] font-medium ${agent.status === "active" ? "bg-success-subtle text-success" : agent.status === "draft" ? "bg-attention-subtle text-attention" : "bg-secondary text-muted-foreground"}`}>{agent.status}</span><span className="text-xs font-medium text-primary">Configure →</span></button>)}</div>}
      </section>
      <details id="new-agent" open={initialAgents.length===0} className="rounded-md border border-border bg-card p-5 sm:p-7"><summary className="cursor-pointer font-semibold">Create an agent</summary><div className="mt-5 max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Create</p><h2 className="mt-2 text-xl font-semibold">Start a new agent</h2><p className="mt-1 text-sm text-muted-foreground">Give your agent a name and describe how it should help.</p></div><form onSubmit={createAgent} className="mt-6 grid gap-4 lg:grid-cols-2"><label className="space-y-1.5 text-sm font-medium">Name<input required value={name} onChange={(e) => { setName(e.target.value); setSlug(nextAgentSlug(e.target.value,slug,slugCustomized)); }} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 font-normal outline-none transition focus:ring-2 focus:ring-ring/20" placeholder="Operations Assistant" /></label><label className="space-y-1.5 text-sm font-medium">Identifier<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(e) => {const value=e.target.value.toLowerCase();setSlug(value);setSlugCustomized(Boolean(value));}} className="mt-1 h-11 w-full rounded-md border px-3 font-normal outline-none focus:ring-2 focus:ring-primary/20" placeholder="operations-assistant" /><span className="block text-xs font-normal text-muted-foreground">Generated from the name; edit only if needed.</span></label><label className="space-y-1.5 text-sm font-medium lg:col-span-2">Purpose<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-3 font-normal outline-none transition focus:ring-2 focus:ring-ring/20" placeholder="What should this agent help your organization accomplish?" /></label><div className="lg:col-span-2"><button disabled={creating} className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50">{creating ? "Creating…" : "Create agent"}</button></div></form></details>
    </main>
  );
}
