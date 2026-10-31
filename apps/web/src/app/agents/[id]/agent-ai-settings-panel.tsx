"use client";

import { useEffect, useRef,useState } from "react";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { LiveModelSelect } from "@/components/live-model-select";
import {applyResponseStylePreset,responseStylePresets} from "@/lib/agents/response-style-presets";
import type {ResponseStylePreset} from "@/lib/agents/response-style-presets";
import type {ConfigurationEditor} from './use-configuration-editor';

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
  configurationEditor,
}: {
  organizationId: string;
  agentId: string;
  configurationEditor?:ConfigurationEditor;
}) {
  const [settings, setSettings] = useState<AiSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const baseline=useRef<AiSettings>(EMPTY),hydrated=useRef(false);
  const governed=configurationEditor!==undefined,configurationView=configurationEditor?.view;
  const [orgProviders, setOrgProviders] = useState({ chat: "openai", voice: "elevenlabs", realtime: "openai", embedding: "openai" });
  const [inheritedPrompt,setInheritedPrompt]=useState("");
  const [selectedPresentation,setSelectedPresentation]=useState<ResponseStylePreset>("executive");

  useEffect(() => {
    if (!organizationId) return;
    void fetch(`/api/settings/ai-runtime?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("Organization defaults unavailable"); return response.json(); })
      .then(({ settings }) => {
        setOrgProviders({
          chat: settings?.defaultProvider || "openai",
          voice: settings?.voiceChatProvider || "elevenlabs",
          realtime: settings?.realtimeVoiceProvider || "openai",
          embedding: settings?.embeddingProvider || "openai",
        });
        setInheritedPrompt(typeof settings?.systemPrompt==="string"?settings.systemPrompt:
          typeof settings?.system_prompt==="string"?settings.system_prompt:"");
      })
      .catch(() => setError("Organization AI defaults could not load; verify inherited providers before changing models."));
  }, [organizationId]);

  useEffect(() => {
    if (!agentId) return;
    if(governed){
      if(hydrated.current)return;
      if(!configurationView)return;
      const candidate=(configurationView.draft??configurationView.active).snapshot.ai;
      if(candidate){baseline.current=candidate;setSettings(candidate);hydrated.current=true;setLoading(false);return;}
    }
    setLoading(true);
    void fetch(`/api/agents/${agentId}/ai-settings?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("AI settings could not load.");
        const body = await r.json();
        return body.aiSettings as AiSettings | null;
      })
      .then((s) => {baseline.current=s??EMPTY;setSettings(s ?? EMPTY);hydrated.current=true;})
      .catch((e) => setError(e instanceof Error ? e.message : "AI settings could not load."))
      .finally(() => setLoading(false));
  }, [agentId, organizationId,configurationView,governed]);

  async function save() {
    setSaving(true); setNotice(""); setError("");
    try {
      if(configurationEditor){
        const patch=Object.fromEntries(Object.entries(settings).filter(([key,value])=>baseline.current[key as keyof AiSettings]!==value));
        if(!Object.keys(patch).length){configurationEditor.markDirty('ai',false);setNotice('No AI changes to save.');return;}
        await configurationEditor.save('ai',{ai:patch});baseline.current={...settings};setNotice('AI settings draft saved. Review and apply when ready; blank fields still inherit workspace defaults.');return;
      }
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
  function applyPresentation(){
    // A preset is visible editable text. Keep existing agent instructions,
    // or copy the inherited organization prompt before creating an override.
    const base=settings.systemPromptOverride??inheritedPrompt;
    const updated=applyResponseStylePreset(base,selectedPresentation);
    if(updated.length>4000){
      setError("The combined prompt is over 4,000 characters. Shorten your existing instructions before applying this preset.");
      return;
    }
    update("systemPromptOverride",updated);
    configurationEditor?.markDirty('ai');
    setError("");
    setNotice("Presentation instructions inserted. Review the editable system prompt, then Save and Apply to activate.");
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading agent AI settings…
      </p>
    );
  }

  return (
    <section onChange={()=>configurationEditor?.markDirty('ai')} className="space-y-5 rounded-md border bg-background p-6 shadow-sm">
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
              onChange={(e) => setSettings((current) => ({ ...current, chatProvider: e.target.value || null, chatModel: null }))}>
              <option value="">(inherit org default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="sarvam">Sarvam AI</option>
            </select>
          </label>
          <label className={labelCls}>Chat model (null = inherit)
            <LiveModelSelect organizationId={organizationId} provider={settings.chatProvider || orgProviders.chat} purpose="chat"
              className={inputCls} value={settings.chatModel} onChange={(selected) => update("chatModel", selected)} allowInherit />
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
              onChange={(e) => setSettings((current) => ({ ...current, voiceChatProvider: e.target.value || null, voiceChatTtsModel: null, voiceChatSttModel: null }))}>
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
            <LiveModelSelect organizationId={organizationId} provider={settings.voiceChatProvider || orgProviders.voice} purpose="tts"
              className={inputCls} value={settings.voiceChatTtsModel} onChange={(selected) => update("voiceChatTtsModel", selected)} allowInherit />
          </label>
          <label className={labelCls}>STT model
            <LiveModelSelect organizationId={organizationId} provider={settings.voiceChatProvider || orgProviders.voice} purpose="stt"
              className={inputCls} value={settings.voiceChatSttModel} onChange={(selected) => update("voiceChatSttModel", selected)} allowInherit />
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
              onChange={(e) => setSettings((current) => ({ ...current, realtimeVoiceProviderOverride: e.target.value || null, realtimeSttModel: null, realtimeTtsModel: null }))}>
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
            <LiveModelSelect organizationId={organizationId} provider={settings.realtimeVoiceProviderOverride || orgProviders.realtime} purpose="stt"
              className={inputCls} value={settings.realtimeSttModel} onChange={(selected) => update("realtimeSttModel", selected)} allowInherit />
          </label>
          <label className={labelCls}>Realtime TTS model
            <LiveModelSelect organizationId={organizationId} provider={settings.realtimeVoiceProviderOverride || orgProviders.realtime} purpose="tts"
              className={inputCls} value={settings.realtimeTtsModel} onChange={(selected) => update("realtimeTtsModel", selected)} allowInherit />
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
              onChange={(e) => setSettings((current) => ({ ...current, embeddingProvider: e.target.value || null, embeddingModel: null, embeddingDimension: null }))}>
              <option value="">(inherit org default)</option>
              <option value="openai">OpenAI</option>
              <option value="gemini">Google Gemini</option>
              <option value="tei">HuggingFace TEI (local)</option>
            </select>
          </label>
          <label className={labelCls}>Embedding model
            <LiveModelSelect organizationId={organizationId} provider={settings.embeddingProvider || orgProviders.embedding} purpose="embedding"
              className={inputCls} value={settings.embeddingModel} onChange={(selected) => update("embeddingModel", selected)} allowInherit />
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
        <div className="rounded-md border bg-muted/30 p-3 space-y-3">
          <div>
            <p className="text-sm font-semibold">Editable response presentation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose a starter profile, then review and edit the text before saving. These instructions guide AI-generated Chat and WhatsApp text, not permissions or provider delivery.
              Deterministic fallback messages use the separately editable schedule presentation (executive, compact, plain).
              WhatsApp supports *bold*, _italic_ and emoji, but not custom text colors; Chat uses Markdown and your app theme.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-44 flex-1 text-xs font-medium">Response profile
              <select className={inputCls} value={selectedPresentation} onChange={event=>setSelectedPresentation(event.target.value as ResponseStylePreset)}>
                {Object.entries(responseStylePresets).map(([value,preset])=><option key={value} value={value}>{preset.label}</option>)}
              </select>
            </label>
            <button type="button" className="h-10 rounded-md border border-primary/40 px-3 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              onClick={applyPresentation} disabled={saving||configurationEditor?.busy||!!configurationEditor&&!configurationEditor.view?.canEditAi}>
              Insert editable instructions
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{responseStylePresets[selectedPresentation].description} · No changes take effect until saved and applied.</p>
        </div>
        <details className="rounded-md border border-border px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">View inherited organization instructions</summary>
          <p className="mt-2 text-xs text-muted-foreground">
            This is the current workspace default. It applies whenever the per-agent field is blank.
            To change it for every agent, edit Organization AI runtime settings instead.
          </p>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/30 p-3 text-xs">{inheritedPrompt || "No organization-level prompt returned by the settings API."}</pre>
        </details>
        <label className={labelCls}>System prompt (editable; blank = inherit organization default)
          <textarea className={inputCls} rows={12} maxLength={4000} placeholder="You are an assistant for…"
            value={settings.systemPromptOverride ?? ""}
            onChange={(e) => update("systemPromptOverride", e.target.value || null)} />
        </label>
        <div className="flex justify-between gap-3 text-xs text-muted-foreground">
          <span>Stored per agent. Configuration history and review apply when enabled. Inherited workspace prompt is preserved when inserting a preset.</span>
          <span>{(settings.systemPromptOverride??"").length}/4000</span>
        </div>
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

      <button type="button" onClick={() => void save()} disabled={saving||configurationEditor?.busy||!!configurationEditor&&!configurationEditor.view?.canEditAi}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">
        <Save size={14} /> {saving ? "Saving…" : configurationEditor?"Save draft":"Save AI overrides"}
      </button>
      {configurationEditor&&<button type="button" disabled={saving||configurationEditor.busy} onClick={()=>{setSettings({...baseline.current});configurationEditor.markDirty('ai',false);setError('');}} className="ml-3 h-10 rounded-md border px-4 text-sm">Cancel edits</button>}
    </section>
  );
}
