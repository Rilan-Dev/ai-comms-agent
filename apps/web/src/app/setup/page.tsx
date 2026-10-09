"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, KeyRound } from "lucide-react";

export default function SetupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ token: "", name: "", email: "", password: "", organizationName: "", organizationSlug: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/bootstrap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? "Initial setup could not be completed.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Initial setup could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <main className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full rounded-md border bg-background/95 p-8 text-center shadow-sm shadow-black/5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="h-6 w-6" /></div>
          <h1 className="mt-5 font-display text-2xl font-medium">Workspace initialized</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Your owner account is ready. Sign in to open the communications workspace.</p>
          <button onClick={() => router.replace("/login")} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90">Continue to sign in <ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
    </main>;
  }

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm(current => ({ ...current, [key]: event.target.value }));

  return <main className="min-h-screen bg-background px-5 py-10">
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg items-center">
      <div className="w-full rounded-md border bg-background/95 p-8 shadow-sm shadow-black/5 backdrop-blur">
        <div className="mb-7">
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-muted-foreground"><KeyRound className="h-3.5 w-3.5 text-primary" /> Clara Comms · first run</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Initialize your workspace</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Create the first organization owner. This route is available only while no password credential exists and requires the server-side bootstrap secret.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="mb-2 block text-sm font-medium">Bootstrap token</span><input value={form.token} onChange={update("token")} type="password" autoComplete="off" required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-medium">Your name</span><input value={form.name} onChange={update("name")} autoComplete="name" required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium">Email</span><input value={form.email} onChange={update("email")} type="email" autoComplete="email" required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /></label>
          </div>
          <label className="block"><span className="mb-2 block text-sm font-medium">Password</span><input value={form.password} onChange={update("password")} type="password" autoComplete="new-password" minLength={12} required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /><span className="mt-1 block text-xs text-muted-foreground">At least 12 characters with uppercase, lowercase and a number.</span></label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-medium">Organization</span><input value={form.organizationName} onChange={update("organizationName")} required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /></label>
            <label className="block"><span className="mb-2 block text-sm font-medium">Organization slug</span><input value={form.organizationSlug} onChange={update("organizationSlug")} pattern="[a-z0-9][a-z0-9\-]{2,62}" required className="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-foreground/20" /></label>
          </div>
          {error ? <div role="alert" className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div> : null}
          <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50">{busy ? "Initializing…" : "Initialize workspace"} {!busy ? <ArrowRight className="h-4 w-4" /> : null}</button>
        </form>
        <div className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground"><a href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Back to sign in</a></div>
      </div>
    </div>
  </main>;
}
