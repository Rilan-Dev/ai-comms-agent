"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
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

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.16),transparent_35%),radial-gradient(circle_at_20%_20%,rgba(14,165,233,.10),transparent_30%)] px-5 py-10">
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
      <div className="w-full rounded-3xl border bg-background/95 p-8 shadow-2xl shadow-black/10 backdrop-blur">
        <div className="mb-8"><div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-sm font-bold text-background">C</div><p className="text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground">Clara Comms</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Sign in to access your organization workspace, agents, mail and messaging.</p></div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-2 block text-sm font-medium">Email</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" autoComplete="email" required className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-foreground/20" /></label>
          <label className="block"><span className="mb-2 block text-sm font-medium">Password</span><input value={password} onChange={e=>setPassword(e.target.value)} type="password" autoComplete="current-password" required className="h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-foreground/20" /></label>
          {error ? <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div> : null}
          <button disabled={busy} className="h-11 w-full rounded-xl bg-foreground px-4 text-sm font-semibold text-background transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="mt-6 flex items-center justify-between gap-4 text-xs text-muted-foreground"><span>Restricted workspace</span><a href="/setup" className="font-medium text-foreground underline-offset-4 hover:underline">First-time setup</a></div>
      </div>
    </div>
  </main>;
}
