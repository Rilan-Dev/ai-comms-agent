"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";

type AiSettings = {
  chatProvider: string | null;
  chatModel: string | null;
  voiceChatProvider: string | null;
  voiceChatTtsModel: string | null;
  voiceChatSttModel: string | null;
  voiceChatVoiceId: string | null;
  realtimeVoiceProviderOverride: string | null;
  realtimeSttModel: string | null;
  realtimeTtsModel: string | null;
  realtimeVoiceIdOverride: string | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  systemPromptOverride: string | null;
  temperatureOverride: number | null;
  maxTokensOverride: number | null;
};

const EMPTY: AiSettings = {
  chatProvider: null, chatModel: null,
  voiceChatProvider: null, voiceChatTtsModel: null, voiceChatSttModel: null, voiceChatVoiceId: null,
  realtimeVoiceProviderOverride: null, realtimeSttModel: null, realtimeTtsModel: null, realtimeVoiceIdOverride: null,
  embeddingProvider: null, embeddingModel: null, embeddingDimension: null,
  systemPromptOverride: null, temperatureOverride: null, maxTokensOverride: null,
};

export function AgentAISettingsPanel({
  organizationId,
  agentId,
}: {
  organizationId: string;
  agentId: string;
}) {
  const [settings, setSettings] = useState<AiSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    void fetch(`/api/agents/${agentId}/ai-settings?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("AI settings could not load.");
        const body = await r.json();
        return body.aiSettings as AiSettings | null;
      })
      .then((s) => setSettings(s ?? EMPTY))
      .catch((e) => setError(e instanceof Error ? e.message : "AI settings could not load."))
      .finally(() => setLoading(false));
  }, [agentId, organizationId]);

  async function save() {
    setSaving(true); setNotice(""); setError("");
    try {
      const response = await fetch(`/api/agents/${agentId}/ai-settings?organizationId=${encodeURIComponent(organizationId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, ...settings }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "AI settings could not save.");
      setNotice("Per-agent AI overrides saved. NULL fields inherit organization defaults.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI settings could not save.");
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof AiSettings>(key: K, value: string | number | null) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const inputCls = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
  const labelCls = "block text-sm font-medium";

  if (loading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading agent AI settings…
      </p>
    );
  }

  return (
    <section className="space-y-5 rounded-md border bg-background p-6 shadow-sm">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Save size={16} className="text-primary" /> Per-agent AI overrides
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every field is optional. Leave blank to inherit the organization-level defaults from <a href="/settings/ai-provider-setup" className="text-primary hover:underline">AI Provider Setup</a>. Explicit values here override the org defaults for this agent only — multiple agents can each have their own AI providers.
        </p>
      </div>
      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" /> {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      ) : null}

      {/* Chat */}
      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Chat model override</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>Chat provider (null = inherit)
            <select className={inputCls}
              value={settings.chatProvider ?? ""}
              onChange={(e) => update("chatProvider", e.target.value || null)}>
              <option value="">(inherit org default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="sarvam">Sarvam AI</option>
            </select>
          </label>
          <label className={labelCls}>Chat model (null = inherit)
            <input className={inputCls} type="text" placeholder="e.g. gpt-4o-mini"
              value={settings.chatModel ?? ""}
              onChange={(e) => update("chatModel", e.target.value || null)} />
          </label>
        </div>
      </fieldset>

      {/* Voice chat */}
      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Voice chat (TTS / STT) override</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>Voice-chat provider (null = inherit)
            <select className={inputCls}
              value={settings.voiceChatProvider ?? ""}
              onChange={(e) => update("voiceChatProvider", e.target.value || null)}>
              <option value="">(inherit org default)</option>
              <option value="elevenlabs">ElevenLabs</option>
              <option value="sarvam">Sarvam AI</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </label>
          <label className={labelCls}>Voice ID (TTS)
            <input className={inputCls} type="text" placeholder="eleven-alloy / shubh / alloy"
              value={settings.voiceChatVoiceId ?? ""}
              onChange={(e) => update("voiceChatVoiceId", e.target.value || null)} />
          </label>
          <label className={labelCls}>TTS model
            <input className={inputCls} type="text" placeholder="eleven_flash_v2_5 / bulbul:v3"
              value={settings.voiceChatTtsModel ?? ""}
              onChange={(e) => update("voiceChatTtsModel", e.target.value || null)} />
          </label>
          <label className={labelCls}>STT model
            <input className={inputCls} type="text" placeholder="scribe_v2 / saaras:v3"
              value={settings.voiceChatSttModel ?? ""}
              onChange={(e) => update("voiceChatSttModel", e.target.value || null)} />
          </label>
        </div>
      </fieldset>

      {/* Realtime */}
      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Realtime voice AI agent override</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>Realtime voice provider (null = inherit)
            <select className={inputCls}
              value={settings.realtimeVoiceProviderOverride ?? ""}
              onChange={(e) => update("realtimeVoiceProviderOverride", e.target.value || null)}>
              <option value="">(inherit org default)</option>
              <option value="openai">OpenAI Realtime</option>
              <option value="gemini">Gemini Live</option>
              <option value="sarvam">Sarvam AI</option>
              <option value="elevenlabs">ElevenLabs Conversational AI</option>
            </select>
          </label>
          <label className={labelCls}>Realtime voice ID
            <input className={inputCls} type="text" placeholder="alloy / sage / shimmer"
              value={settings.realtimeVoiceIdOverride ?? ""}
              onChange={(e) => update("realtimeVoiceIdOverride", e.target.value || null)} />
          </label>
          <label className={labelCls}>Realtime STT model
            <input className={inputCls} type="text" placeholder="scribe_v2_realtime / saaras:v3-realtime"
              value={settings.realtimeSttModel ?? ""}
              onChange={(e) => update("realtimeSttModel", e.target.value || null)} />
          </label>
          <label className={labelCls}>Realtime TTS model
            <input className={inputCls} type="text" placeholder="eleven_flash_v2_5"
              value={settings.realtimeTtsModel ?? ""}
              onChange={(e) => update("realtimeTtsModel", e.target.value || null)} />
          </label>
        </div>
      </fieldset>

      {/* Embedding */}
      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Embedding model override</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelCls}>Embedding provider (null = inherit)
            <select className={inputCls}
              value={settings.embeddingProvider ?? ""}
              onChange={(e) => update("embeddingProvider", e.target.value || null)}>
              <option value="">(inherit org default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="tei">HuggingFace TEI (local)</option>
            </select>
          </label>
          <label className={labelCls}>Embedding model
            <input className={inputCls} type="text" placeholder="text-embedding-3-small"
              value={settings.embeddingModel ?? ""}
              onChange={(e) => update("embeddingModel", e.target.value || null)} />
          </label>
          <label className={labelCls}>Dimension
            <input className={inputCls} type="number" min="1" max="4096" placeholder="1536"
              value={settings.embeddingDimension ?? ""}
              onChange={(e) => update("embeddingDimension", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
        </div>
      </fieldset>

      {/* Runtime overrides */}
      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Runtime behavior override</legend>
        <label className={labelCls}>System prompt (null = inherit org default)
          <textarea className={inputCls} rows={3} placeholder="You are Clara, an assistant for…"
            value={settings.systemPromptOverride ?? ""}
            onChange={(e) => update("systemPromptOverride", e.target.value || null)} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelCls}>Temperature (0–2; null = inherit)
            <input className={inputCls} type="number" min="0" max="2" step="0.1" placeholder="0.8"
              value={settings.temperatureOverride ?? ""}
              onChange={(e) => update("temperatureOverride", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
          <label className={labelCls}>Max tokens (null = inherit)
            <input className={inputCls} type="number" min="1" max="32768" placeholder="1500"
              value={settings.maxTokensOverride ?? ""}
              onChange={(e) => update("maxTokensOverride", e.target.value === "" ? null : Number(e.target.value))} />
          </label>
        </div>
      </fieldset>

      <button type="button" onClick={() => void save()} disabled={saving}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">
        <Save size={14} /> {saving ? "Saving…" : "Save AI overrides"}
      </button>
    </section>
  );
}
