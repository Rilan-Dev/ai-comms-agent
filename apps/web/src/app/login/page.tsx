"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { ArrowRight, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Sign in failed.");
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) { setError(err instanceof Error ? err.message : "Sign in failed."); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-background px-5 py-10">
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
      <div className="w-full rounded-md border bg-background/95 p-8 shadow-sm shadow-black/5 backdrop-blur">
        <div className="mb-8"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-md bg-foreground text-background"><ShieldCheck className="h-5 w-5" /></div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Clara Comms</p><h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Welcome back</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to access your organization workspace, agents, mail and messaging.</p></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-2 block text-sm font-medium">Email</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-foreground/20" /></label>
          <label className="block"><span className="mb-2 block text-sm font-medium">Password</span><input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-foreground/20" /></label>
          {error ? <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div> : null}
          <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Signing in…" : "Sign in"} {!busy ? <ArrowRight className="h-4 w-4" /> : null}</button>
        </form>
        <div className="mt-6 flex items-center justify-between gap-4 text-xs text-muted-foreground"><span>Restricted workspace</span><a href="/setup" className="font-medium text-foreground underline-offset-4 hover:underline">First-time setup</a></div>
      </div>
    </div>
  </main>;
}
