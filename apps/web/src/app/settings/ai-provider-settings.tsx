"use client";

import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveModelSelect } from "@/components/live-model-select";

type Provider = "openai" | "gemini" | "sarvam";
type Config = { provider: Provider; model: string; enabled: boolean; hasApiKey: boolean; baseUrl: string };
const labels: Record<Provider, string> = { openai: "OpenAI", gemini: "Google Gemini", sarvam: "Sarvam AI" };

export function AIProviderSettings({ organizationId }: { organizationId: string }) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  async function load() {
    if (!organizationId) return;
    const response = await fetch("/api/settings/ai-providers?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message ?? "Provider settings could not load.");
    setConfigs(body.providers ?? []);
    const selectedConfig = (body.providers ?? []).find((item: Config) => item.provider === provider);
    if (selectedConfig) {
      setModel(selectedConfig.model || "");
      setBaseUrl(selectedConfig.baseUrl ?? "");
      setEnabled(selectedConfig.enabled);
    }
  }
  useEffect(() => { void load().catch((e) => setError(e instanceof Error ? e.message : "Provider settings could not load.")); }, [organizationId]);
  function choose(next: Provider) {
    setProvider(next); setApiKey("");
    const config = configs.find((item) => item.provider === next);
    setModel(config?.model || "");
    setBaseUrl(config?.baseUrl ?? ""); setEnabled(config?.enabled ?? true);
  }
  async function save() {
    setBusy(true); setNotice(""); setError("");
    try {
      const existing = configs.find((item) => item.provider === provider);
      const response = await fetch("/api/settings/ai-providers", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, provider, model, apiKey, baseUrl, enabled, keepExistingKey: !apiKey && Boolean(existing?.hasApiKey) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Provider settings could not save.");
      setApiKey(""); setNotice(body.message ?? "Provider settings saved."); await load(); setCatalogVersion((n) => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : "Provider settings could not save."); }
    finally { setBusy(false); }
  }
  const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
  const label = "block text-sm font-medium";
  const current = configs.find((item) => item.provider === provider);
  return <section className="space-y-4 rounded-md border border-border bg-card p-5 sm:p-6">
    <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground"><KeyRound className="h-3.5 w-3.5 text-primary" />AI providers</p><h2 className="mt-1 text-xl font-semibold">API credentials and model catalog</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Configure provider credentials per organization. Keys are encrypted before database storage and are never sent back to the browser. Save the key first to load the current provider catalogue; then choose a model and save again.</p></div>
    {notice ? <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">{notice}</p> : null}
    {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
    {!configs.some((item) => item.enabled && item.hasApiKey) ? <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">No enabled chat provider has a saved API key yet. Configure and save a provider before starting chat.</p> : null}
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-4">
        <label className={label}>Provider<select className={input} value={provider} onChange={(e) => choose(e.target.value as Provider)}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="sarvam">Sarvam AI</option></select></label>
        <div className="rounded-md border border-border p-3 text-sm"><span className="font-medium">{labels[provider]} status: </span>{current?.hasApiKey ? "API key saved (hidden)" : "Not configured"}</div>
        <label className={label}>API key<input className={input} type="password" autoComplete="new-password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={current?.hasApiKey ? "Leave blank to keep current key" : "Enter provider API key"} /></label>
        <label className={label}>API base URL (optional)<input className={input} type="url" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider === "gemini" ? "https://generativelanguage.googleapis.com" : provider === "sarvam" ? "https://api.sarvam.ai" : "https://api.openai.com"} /></label>
      </div>
      <div className="space-y-4">
        <div className={label}>Chat model<LiveModelSelect organizationId={organizationId} provider={provider} purpose="chat" value={model || null} onChange={(next) => setModel(next || "")} refreshKey={catalogVersion} className={input} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable this provider</label>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void save()} disabled={busy} className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Saving…" : "Save provider"}</button></div>
        <p className="text-xs leading-5 text-muted-foreground">All dropdown choices are fetched live from the provider using this organization’s saved key. No prefilled or static models are substituted. A successful save does not verify connectivity.</p>
      </div>
    </div>
  </section>;
}
