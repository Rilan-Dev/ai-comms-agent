"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { LiveModelSelect, type ModelPurpose } from "@/components/live-model-select";
import { providerConfigStatus } from "@/lib/ai/provider-config-status";
import { voiceCredentialSaveError } from "@/lib/ai/voice-credential-preflight";
import { PROVIDER_SETUP_OPTIONS, providerSetupStatus } from "@/lib/ai/provider-setup-guide";



type Tab = "chat" | "voice-chat" | "realtime" | "embedding";

type Config = {
  id: string;
  provider: string;
  purpose: string;
  model: string | null;
  enabled: boolean;
  hasApiKey: boolean;
  baseUrl: string | null;
};

const PURPOSE_FOR_TAB: Record<Tab, string> = {
  chat: "chat",
  "voice-chat": "tts", // voice-chat has 2 sub-purposes (tts + stt); we list both
  realtime: "realtime",
  embedding: "embedding",
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  sarvam: "Sarvam AI",
  elevenlabs: "ElevenLabs",
  tei: "HuggingFace TEI (local)",
};

const PROVIDER_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
  sarvam: "https://api.sarvam.ai",
  elevenlabs: "https://api.elevenlabs.io",
  tei: "",
};

// Derive the card and selection allowlist from the same typed capability
// inventory; the server API independently validates every provider/purpose.
const ALLOWED_PROVIDERS: Record<Tab, string[]> = {
  chat: PROVIDER_SETUP_OPTIONS.chat.map((option) => option.id),
  "voice-chat": PROVIDER_SETUP_OPTIONS["voice-chat"].map((option) => option.id),
  realtime: PROVIDER_SETUP_OPTIONS.realtime.map((option) => option.id),
  embedding: PROVIDER_SETUP_OPTIONS.embedding.map((option) => option.id),
};

export function AIProviderSetupShared({
  organizationId,
  tab,
}: {
  organizationId: string;
  tab: Tab;
}) {
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [loadRetry, setLoadRetry] = useState(0);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState("");
  const currentOrganizationId = useRef(organizationId);
  currentOrganizationId.current = organizationId;
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState("");
  const [sttModel, setSttModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Reset provider + model when tab changes
  useEffect(() => {
    setProvider("");
    setModel("");
    setSttModel("");
    setApiKey("");
    setBaseUrl("");
    setEnabled(true);
    setNotice("");
    setError("");
  }, [tab]);

  // A secret typed in organization A must never survive switching to B.
  useEffect(() => {
    setApiKey("");
    setProvider("");
    setModel("");
    setSttModel("");
    setConfigs([]);
    setLoadedOrganizationId("");
    setNotice("");
    setError("");
  }, [organizationId]);

  // Never let a late response from organization A overwrite organization B.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadedOrganizationId("");
    setConfigs([]);
    if (!organizationId) {
      setLoading(false);
      return () => controller.abort();
    }
    const purposes = tab === "voice-chat" ? ["tts", "stt", "realtime"] : [PURPOSE_FOR_TAB[tab]];
    void Promise.all(
      purposes.map((p) =>
        fetch(`/api/settings/ai-provider-configs?purpose=${p}&organizationId=${encodeURIComponent(organizationId)}`, {
          cache: "no-store",
          signal: controller.signal,
        }).then(async (response) => {
          const body = await response.json().catch(() => null) as { configs?: Config[]; message?: string } | null;
          if (!response.ok) throw new Error(body?.message ?? "Provider configs could not load.");
          return body?.configs ?? [];
        }),
      ),
    )
      .then((groups) => {
        if (controller.signal.aborted) return;
        setConfigs(groups.flat());
        setLoadedOrganizationId(organizationId);
        setError("");
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Provider configs could not load.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [organizationId, tab, loadRetry]);

  const organizationReady = Boolean(organizationId) && loadedOrganizationId === organizationId && !loading;
  const visibleConfigs = loadedOrganizationId === organizationId ? configs : [];

  // Restore the provider's own saved values, never choose a static default.
  useEffect(() => {
    const purpose = PURPOSE_FOR_TAB[tab];
    const activeConfigs = loadedOrganizationId === organizationId ? configs : [];
    const current = activeConfigs.find((c) => c.provider === provider && c.purpose === purpose);
    setModel(current?.model || "");
    setSttModel(activeConfigs.find((c) => c.provider === provider && c.purpose === "stt")?.model || "");
    setBaseUrl(current?.baseUrl || PROVIDER_BASE_URLS[provider] || "");
    setEnabled(current?.enabled ?? true);
  }, [provider, tab, configs, organizationId, loadedOrganizationId]);

  function chooseProvider(next: string) {
    if (next === provider || !organizationReady || saving || (next !== "" && !ALLOWED_PROVIDERS[tab].includes(next))) return;
    // Never carry an unsaved secret from one vendor's password field into another.
    setProvider(next);
    // Prevent the previous provider's unsaved model IDs from being submitted
    // before the new provider's saved configuration finishes restoring.
    setModel("");
    setSttModel("");
    setApiKey("");
    setNotice("");
    setError("");
  }

  async function saveProvider() {
    if (!organizationReady) {
      setError("Load the selected organization's provider settings before saving.");
      return;
    }
    if (!provider || !ALLOWED_PROVIDERS[tab].includes(provider)) {
      setError("Choose a compatible provider before saving.");
      return;
    }
    // Both purpose-scoped records must already have a secret, or this form
    // must provide a new key. Fail before the first PUT, not after a partial
    // TTS save while STT is still missing a key.
    const missingKeyError = voiceCredentialSaveError({
      provider, isVoiceChat: tab === "voice-chat",
      newKeySupplied: Boolean(apiKey.trim()),
      saved: visibleConfigs,
    });
    if (missingKeyError) {
      setError(missingKeyError);
      setNotice("");
      return;
    }
    setSaving(true); setNotice(""); setError("");
    try {
      // Voice Chat stores distinct TTS/STT choices, not one model in two slots.
      const purposes = tab === "voice-chat" ? ["tts", "stt"] : [PURPOSE_FOR_TAB[tab]];
      for (const purpose of purposes) {
        if (currentOrganizationId.current !== organizationId) return;
        const existing = configs.find((c) => c.provider === provider && c.purpose === purpose);
        const response = await fetch("/api/settings/ai-provider-configs", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId,
            purpose,
            provider,
            model: purpose === "stt" ? sttModel : model,
            apiKey: apiKey.trim() || undefined,
            baseUrl: baseUrl || undefined,
            enabled,
            keepExistingKey: !apiKey.trim() && Boolean(existing?.hasApiKey),
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Save failed.");
      }
      if (currentOrganizationId.current !== organizationId) return;
      setApiKey("");
      // Reload
      // Realtime is read-only metadata on this tab. Preserve its status
      // after Save/Remove so the explicit reuse action remains discoverable.
      const refreshed = await Promise.all(
        (tab === "voice-chat" ? [...purposes, "realtime"] : purposes).map((p) =>
          fetch(`/api/settings/ai-provider-configs?purpose=${p}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
            .then(async (r) => {
              const body = await r.json().catch(() => null) as { configs?: Config[]; message?: string } | null;
              if (!r.ok) throw new Error(body?.message ?? "Provider configs could not reload.");
              return body?.configs ?? [];
            })
        ),
      );
      if (currentOrganizationId.current !== organizationId) return;
      setConfigs(refreshed.flat());
      setCatalogVersion((n) => n + 1);
      setNotice("Provider settings saved. Secret values are never returned to the browser.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provider settings could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function reuseSavedRealtimeKey() {
    if (!organizationReady || tab !== "voice-chat" || provider !== "elevenlabs") return;
    if (!confirm("Reuse the enabled ElevenLabs Realtime API key for missing TTS/STT credentials in this organization? Existing keys and disabled capabilities will not be overwritten.")) return;
    setSaving(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/settings/ai-provider-configs/reuse-voice-key", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, provider: "elevenlabs" }),
      });
      const body = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(body?.message || "Unable to reuse the saved key.");
      if (currentOrganizationId.current !== organizationId) return;
      setNotice(body?.message || "Voice credentials updated. Select TTS/STT models and save.");
      setCatalogVersion((version) => version + 1);
      setLoadRetry((version) => version + 1);
    } catch (reason) {
      if (currentOrganizationId.current === organizationId) {
        setError(reason instanceof Error ? reason.message : "Unable to reuse saved credentials.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider() {
    if (!organizationReady) {
      setError("Load the selected organization's provider settings before removing credentials.");
      return;
    }
    if (!provider || !ALLOWED_PROVIDERS[tab].includes(provider)) return;
    if (!confirm(`Remove the saved ${provider} configuration for this purpose? This deletes the encrypted API key.`)) return;
    setSaving(true); setNotice(""); setError("");
    try {
      const purposes = tab === "voice-chat" ? ["tts", "stt"] : [PURPOSE_FOR_TAB[tab]];
      for (const purpose of purposes) {
        if (currentOrganizationId.current !== organizationId) return;
        const response = await fetch(`/api/settings/ai-provider-configs?purpose=${purpose}&provider=${provider}&organizationId=${encodeURIComponent(organizationId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(body?.message || `Could not remove the ${purpose} configuration (HTTP ${response.status}). Other capabilities may have been changed; reload to review.`);
        }
      }
      if (currentOrganizationId.current !== organizationId) return;
      setNotice("Provider config removed.");
      setApiKey("");
      // Realtime is read-only metadata on this tab. Preserve its status
      // after Save/Remove so the explicit reuse action remains discoverable.
      const refreshed = await Promise.all(
        (tab === "voice-chat" ? [...purposes, "realtime"] : purposes).map((p) =>
          fetch(`/api/settings/ai-provider-configs?purpose=${p}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
            .then(async (r) => {
              const body = await r.json().catch(() => null) as { configs?: Config[]; message?: string } | null;
              if (!r.ok) throw new Error(body?.message ?? "Provider configs could not reload.");
              return body?.configs ?? [];
            })
        ),
      );
      if (currentOrganizationId.current !== organizationId) return;
      setConfigs(refreshed.flat());
      // Drop any catalogue fetched using credentials that were just removed.
      setCatalogVersion((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove provider config.");
    } finally {
      setSaving(false);
    }
  }

  const current = visibleConfigs.find((c) => c.provider === provider && c.purpose === PURPOSE_FOR_TAB[tab]);
  const realtimeVoiceConfig = visibleConfigs.find((c) => c.provider === "elevenlabs" && c.purpose === "realtime");
  const missingVoiceKey = ["tts", "stt"].some((purpose) => {
    const capability = visibleConfigs.find((config) =>
      config.provider === "elevenlabs" && config.purpose === purpose);
    return !capability || (capability.enabled && !capability.hasApiKey);
  });
  const canReuseRealtimeKey = tab === "voice-chat" && provider === "elevenlabs"
    && realtimeVoiceConfig?.enabled === true && realtimeVoiceConfig.hasApiKey && missingVoiceKey;
  const inputCls = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
  const labelCls = "block text-sm font-medium";

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">1. Choose a provider</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              These services are compatible with this capability. Choose one to view its own setup; you can configure more than one.
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {ALLOWED_PROVIDERS[tab].length} compatible options
          </span>
        </div>
        {loading ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading this organization's provider settings…
          </p>
        ) : !organizationReady ? (
          <div role="status" className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>{organizationId ? "Provider settings for this organization could not be loaded." : "Select an organization to configure AI providers."}</span>
            {organizationId ? <button type="button" className="underline" onClick={() => setLoadRetry((n) => n + 1)}>Retry loading</button> : null}
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="Available AI providers">
              {PROVIDER_SETUP_OPTIONS[tab].map((option) => {
                const p = option.id;
                const requiredPurposes = tab === "voice-chat" ? ["tts", "stt"] : [PURPOSE_FOR_TAB[tab]];
                const savedKeyStatus = providerConfigStatus(visibleConfigs, p, requiredPurposes);
                const status = providerSetupStatus(visibleConfigs, p, requiredPurposes);
                const selected = p === provider;
                const color = status.state === "configured" ? "text-emerald-700 dark:text-emerald-400"
                  : status.state === "not-configured" ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400";
                return (
                  <button key={p} type="button" onClick={() => chooseProvider(p)}
                    aria-pressed={p === provider} disabled={saving}
                    className={"group flex min-h-44 flex-col rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60 " +
                      (selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border bg-background hover:border-primary/50 hover:bg-muted/30")}>
                    <span className="flex w-full items-start justify-between gap-2">
                      <strong className="text-base">{option.label}</strong>
                      <span className={"text-xs font-semibold " + color}>{status.label}</span>
                    </span>
                    <span className="mt-1 text-sm font-medium">{option.summary}</span>
                    <span className="mt-2 text-xs leading-5 text-muted-foreground">{option.details}</span>
                    <span className="mt-auto flex w-full items-center justify-between gap-2 pt-4 text-xs">
                      <span className="text-muted-foreground">
                        {savedKeyStatus === "active" ? "Credentials enabled" :
                          savedKeyStatus === "saved (disabled)" ? "Credentials disabled" :
                          savedKeyStatus === "incomplete" ? "Some credentials saved" : "No credentials saved"}
                      </span>
                      <span className="font-semibold text-primary">{selected ? "Selected" : "Configure →"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              “Configured” means an enabled credential and model are saved for each required capability. It does not verify provider connectivity, usage quotas, or live voice transport.
            </p>
          </>
        )}
      </div>

      {notice ? <p role="status" className="rounded-xl border border-border bg-card px-4 py-3 text-sm">{notice}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}

      {organizationReady && !provider ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center" role="status">
          <h3 className="text-base font-semibold">Choose a provider to configure</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            No provider is selected. Select its card above to review credentials, supported models and the steps to save. Existing provider settings are not changed by browsing.
          </p>
        </div>
      ) : null}

      {organizationReady && provider ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Provider setup guide</p>
              <h3 className="mt-1 text-xl font-semibold">{PROVIDER_LABELS[provider] || provider}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {providerSetupStatus(visibleConfigs,provider,
                  tab === "voice-chat" ? ["tts","stt"] : [PURPOSE_FOR_TAB[tab]]).detail}
              </p>
            </div>
            <button type="button" onClick={() => chooseProvider("")} disabled={saving}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50">
              Back to providers
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">2. Add or review credentials</h4>
                <p className="mt-1 text-xs text-muted-foreground">Credentials are stored for this organization and this specific capability. Leave the API key blank to retain a previously saved key.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{PROVIDER_LABELS[provider] || provider} credentials</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {current?.hasApiKey ? (current.enabled ? "Key saved and enabled for this capability." : "Key saved, but this capability is disabled.") : "No key saved for this capability yet."}
                  {tab === "voice-chat" ? " Voice Chat needs BOTH TTS and STT configured." : ""}
                </p>
              </div>
              {tab === "voice-chat" ? (
                <div className="space-y-2 rounded-lg border border-border p-3 text-xs leading-5">
                  <h5 className="font-semibold">Voice capability checklist</h5>
                  <div className="grid gap-2 sm:grid-cols-2" role="status" aria-label="Voice capability credentials">
                    {(["tts","stt"] as const).map((purpose) => {
                      const saved = visibleConfigs.find((entry) => entry.provider === provider && entry.purpose === purpose);
                      return <div key={purpose} className="rounded-md bg-muted/30 p-2">
                        <strong>{purpose.toUpperCase()}</strong>
                        <p className="text-muted-foreground">{saved?.hasApiKey ? (saved.enabled ? "Key enabled" : "Key disabled") : "Key required"}</p>
                        <p className="text-muted-foreground">{saved?.model ? "Model saved" : "Model not selected"}</p>
                      </div>;
                    })}
                  </div>
                  {provider === "elevenlabs" ? (
                    <>
                      <p>ElevenLabs voice chat requires separate enabled TTS and STT settings. A key saved under Realtime is not automatically configured for these capabilities.</p>
                      {canReuseRealtimeKey ? <button type="button" onClick={() => void reuseSavedRealtimeKey()} disabled={saving}
                        className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-secondary disabled:opacity-50">
                        Use saved Realtime key for missing TTS/STT
                      </button> : null}
                      <p>Alternatively, provide an API key below for these voice capabilities, save it, select both live models and save again.</p>
                    </>
                  ) : <p>Choose a supported model separately for speech output (TTS) and recognition (STT).</p>}
                </div>
              ) : null}
              <label className={labelCls}>API key
                <input className={inputCls} type="password" autoComplete="new-password" value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={current?.hasApiKey ? "Leave blank to keep the saved key" : "Enter provider API key"} />
              </label>
              <label className={labelCls}>API base URL
                <input className={inputCls} type="url" value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={PROVIDER_BASE_URLS[provider] || "http://localhost:8080"}
                  disabled={!PROVIDER_BASE_URLS[provider] && provider !== "tei"} />
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold">3. Choose supported models</h4>
                <p className="mt-1 text-xs text-muted-foreground">Save the credential first if the model list cannot load. Then select a compatible model and save again.</p>
              </div>
              <div className={labelCls}>
                {tab === "voice-chat" ? "Text-to-speech model" :
                  tab === "realtime" && (provider === "sarvam" || provider === "elevenlabs") ?
                  "Realtime speech-recognition model" : "Model"}
                <LiveModelSelect key={`${organizationId}:${tab}:${provider}:model`} organizationId={organizationId} provider={provider}
                  purpose={PURPOSE_FOR_TAB[tab] as ModelPurpose} value={model || null}
                  onChange={(next) => setModel(next || "")} refreshKey={catalogVersion} className={inputCls}
                  onReuseSavedRealtimeKey={canReuseRealtimeKey ? () => void reuseSavedRealtimeKey() : undefined}
                  reuseCredentialBusy={saving} />
              </div>
              {tab === "voice-chat" ? (
                <div className={labelCls}>Speech-to-text model
                  <LiveModelSelect key={`${organizationId}:${tab}:${provider}:stt`} organizationId={organizationId} provider={provider}
                    purpose="stt" value={sttModel || null} onChange={(next) => setSttModel(next || "")}
                    refreshKey={catalogVersion} className={inputCls}
                    onReuseSavedRealtimeKey={canReuseRealtimeKey ? () => void reuseSavedRealtimeKey() : undefined}
                    reuseCredentialBusy={saving} />
                </div>
              ) : null}
              <p className="text-xs leading-5 text-muted-foreground">
                {tab === "realtime" && (provider === "sarvam" || provider === "elevenlabs")
                  ? "These streaming speech models are documented by the vendor, not fetched from a live per-key catalogue. Availability is confirmed when a session connects. This app uses the authorized host agent and speech pipeline, not ElevenLabs Conversational AI agents."
                  : "Model options are fetched from the provider's live API with this organization's saved key. Save the key first, choose a listed model, and save again. Unsupported capabilities are never presented as live."}
              </p>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <h4 className="text-sm font-semibold">4. Review and save</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={saving} />
                  Enable this provider for this capability
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void saveProvider()} disabled={saving}
                    className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
                    {saving ? "Saving…" : "Save provider"}
                  </button>
                  {current?.hasApiKey ? (
                    <button type="button" onClick={() => void deleteProvider()} disabled={saving}
                      className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" /> Remove credentials
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">Enabling a provider does not automatically change another agent's model override. A saved key does not guarantee a live session.</p>
              </div>
            </div>
          </div>
          <p className="border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
            Keys are envelope-encrypted (AES-256-GCM) with CREDENTIALS_MASTER_KEY and stored as <code>encrypted_api_key</code> on <code>ai_provider_configs</code>. They are never returned to the browser.
          </p>
        </div>
      ) : null}
    </section>
  );
}
