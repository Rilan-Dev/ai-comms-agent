"use client";

import { useState, type ChangeEvent } from "react";
import { Bot, ShieldCheck } from "lucide-react";

export default function NewAgentPage() {
  const [name, setName] = useState("");

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  return (
    <main className="mx-auto max-w-3xl p-5 sm:p-8 lg:p-12">
      <a href="/agents" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
        ← Agents
      </a>
      <h1 className="mt-5 flex items-center gap-2 font-display text-3xl font-medium tracking-tight"><Bot size={24} className="text-primary" /> Create an agent</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Start with the identity and behavior. Channel connections, Clara AI providers, tools, and authorization are configured after creation.
      </p>

      <div className="mt-8 space-y-6 rounded-md border bg-background p-6 shadow-sm">
        <label className="block">
          <span className="text-sm font-medium">Agent name</span>
          <input
            value={name}
            onChange={handleNameChange}
            placeholder="e.g. Clara"
            className="mt-2 h-11 w-full rounded-md border bg-background px-3 text-sm outline-none ring-primary/20 focus:ring-4"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Purpose</span>
          <textarea
            placeholder="What should this agent help with?"
            className="mt-2 min-h-28 w-full rounded-md border bg-background p-3 text-sm outline-none focus:ring-4 focus:ring-primary/20"
          />
        </label>

        <div className="rounded-md bg-muted/60 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium"><ShieldCheck size={15} className="text-primary" /> Safety default</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Reading and drafting are allowed. Sending, forwarding, deletion, and bulk actions require explicit authorization.
          </p>
        </div>

        <button
          type="button"
          className="h-11 rounded-md bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-40"
          disabled={!name.trim()}
        >
          Create agent
        </button>
      </div>
    </main>
  );
}
