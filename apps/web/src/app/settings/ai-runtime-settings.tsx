"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { LiveModelSelect } from "@/components/live-model-select";

type RuntimeSettings = {
  default_provider: string;
  knowledge_base_id: string;
  realtime_voice_provider: string;
  realtime_voice_model: string;
  voice_id: string;
  temperature: number | string;
  max_tokens: number | string;
  system_prompt: string;
};
const initial: RuntimeSettings = {
  default_provider: "openai", knowledge_base_id: "", realtime_voice_provider: "openai",
  realtime_voice_model: "", voice_id: "alloy", temperature: 0.8,
  max_tokens: 1500, system_prompt: "You are Clara, a helpful AI assistant for the user's communication workspace."
};

export function AIRuntimeSettings({ organizationId }: { organizationId: string }) {
  const [settings, setSettings] = useState<RuntimeSettings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!organizationId) return;
    void fetch(`/api/settings/ai-runtime?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.message ?? "AI configuration could not load."); return body.settings; })
      .then((value) => setSettings({
        ...initial, ...value,
        // The persisted API uses camelCase; this form submits snake_case.
        // Normalize only the provider/model fields touched by live selection.
        realtime_voice_provider: value?.realtime_voice_provider ?? value?.realtimeVoiceProvider ?? initial.realtime_voice_provider,
        realtime_voice_model: value?.realtime_voice_model ?? value?.realtimeVoiceModel ?? "",
      }))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "AI configuration could not load."))
      .finally(() => setLoading(false));
  }, [organizationId]);
  async function save() {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch("/api/settings/ai-runtime", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, ...settings, temperature: Number(settings.temperature), max_tokens: Number(settings.max_tokens) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "AI configuration could not save.");
      setMessage("AI runtime configuration saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "AI configuration could not save."); }
    finally { setSaving(false); }
  }
  const input = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
  const label = "block text-sm font-medium";
  return <section className="space-y-5 rounded-md border border-border bg-card p-5 sm:p-6">
    <div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5 text-primary" />AI & Clara runtime</p><h2 className="mt-1 text-xl font-semibold">Knowledge, model defaults and voice</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">These settings are saved per organization. The knowledge-base ID is required by chat and voice; it must identify a knowledge base actually configured for Clara. This setting does not create a Qdrant collection or ingest documents.</p></div>
    {message ? <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">{message}</p> : null}
    {error ? <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
    {!loading && !settings.knowledge_base_id.trim() ? <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Required configuration missing: enter the actual Clara knowledge-base ID and save. Chat, voice, and worker agent execution will return configuration_required until it is set.</p> : null}
    {loading ? <p className="text-sm text-muted-foreground">Loading configuration…</p> : <>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={label}>Clara knowledge-base ID<input className={input} value={settings.knowledge_base_id} onChange={(e) => setSettings({ ...settings, knowledge_base_id: e.target.value })} placeholder="Your actual Clara KB ID" /></label>
        <label className={label}>Default chat provider<select className={input} value={settings.default_provider} onChange={(e) => setSettings({ ...settings, default_provider: e.target.value })}><option value="openai">OpenAI</option><option value="gemini">Google Gemini</option><option value="sarvam">Sarvam AI</option></select></label>
        <label className={label}>Realtime voice provider<select className={input} value={settings.realtime_voice_provider} onChange={(e) => setSettings({ ...settings, realtime_voice_provider: e.target.value, realtime_voice_model: "" })}><option value="openai">OpenAI Realtime</option><option value="gemini">Gemini Live</option><option value="sarvam">Sarvam</option><option value="elevenlabs">ElevenLabs</option></select></label>
        <div className={label}>Realtime voice model<LiveModelSelect organizationId={organizationId} provider={settings.realtime_voice_provider} purpose="realtime" value={settings.realtime_voice_model || null} onChange={(model) => setSettings({ ...settings, realtime_voice_model: model || "" })} className={input} /></div>
        <label className={label}>Voice ID / preset<input className={input} value={settings.voice_id} onChange={(e) => setSettings({ ...settings, voice_id: e.target.value })} /></label>
        <label className={label}>Temperature (0–2)<input className={input} type="number" min="0" max="2" step="0.1" value={settings.temperature} onChange={(e) => setSettings({ ...settings, temperature: e.target.value })} /></label>
        <label className={label}>Maximum output tokens<input className={input} type="number" min="1" max="32768" value={settings.max_tokens} onChange={(e) => setSettings({ ...settings, max_tokens: e.target.value })} /></label>
      </div>
      <label className={label}>System prompt<textarea className={input} rows={4} value={settings.system_prompt} onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })} /></label>
      <button type="button" onClick={() => void save()} disabled={saving} className="rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-50">{saving ? "Saving…" : "Save AI runtime settings"}</button>
    </>}
  </section>;
}
