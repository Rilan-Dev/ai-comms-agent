"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { LiveModelSelect, type ModelPurpose } from "@/components/live-model-select";



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

const ALLOWED_PROVIDERS: Record<Tab, string[]> = {
  chat: ["openai", "gemini", "sarvam"],
  "voice-chat": ["elevenlabs", "sarvam"],
  realtime: ["openai", "gemini", "sarvam", "elevenlabs"],
  embedding: ["openai", "gemini", "tei"],
};

export function AIProviderSetupShared({
  organizationId,
  tab,
}: {
  organizationId: string;
  tab: Tab;
}) {
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [configs, setConfigs] = useState<Config[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [provider, setProvider] = useState<string>(ALLOWED_PROVIDERS[tab][0] ?? "");
  const [model, setModel] = useState("");
  const [sttModel, setSttModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(true);

  // Reset provider + model when tab changes
  useEffect(() => {
    setProvider(ALLOWED_PROVIDERS[tab][0] ?? "");
    setModel("");
    setSttModel("");
    setApiKey("");
    setBaseUrl("");
    setEnabled(true);
    setNotice("");
    setError("");
  }, [tab]);

  // Load configs when tab changes
  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    const purposes = tab === "voice-chat" ? ["tts", "stt"] : [PURPOSE_FOR_TAB[tab]];
    Promise.all(
      purposes.map((p) =>
        fetch(`/api/settings/ai-provider-configs?purpose=${p}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
          .then(async (r) => {
            if (!r.ok) throw new Error("Provider configs could not load.");
            const body = await r.json();
            return (body.configs ?? []) as Config[];
          })
      ),
    )
      .then((groups) => setConfigs(groups.flat()))
      .catch((e) => setError(e instanceof Error ? e.message : "Provider configs could not load."))
      .finally(() => setLoading(false));
  }, [organizationId, tab]);

  // Restore the provider's own saved values, never choose a static default.
  useEffect(() => {
    const purpose = PURPOSE_FOR_TAB[tab];
    const current = configs.find((c) => c.provider === provider && c.purpose === purpose);
    setModel(current?.model || "");
    setSttModel(configs.find((c) => c.provider === provider && c.purpose === "stt")?.model || "");
    setBaseUrl(current?.baseUrl || PROVIDER_BASE_URLS[provider] || "");
    setEnabled(current?.enabled ?? true);
  }, [provider, tab, configs]);

  function chooseProvider(next: string) {
    if (next === provider) return;
    // Never carry an unsaved secret from one vendor's password field into another.
    setProvider(next);
    setApiKey("");
    setNotice("");
    setError("");
  }

  async function saveProvider() {
    setSaving(true); setNotice(""); setError("");
    try {
      // Voice Chat stores distinct TTS/STT choices, not one model in two slots.
      const purposes = tab === "voice-chat" ? ["tts", "stt"] : [PURPOSE_FOR_TAB[tab]];
      for (const purpose of purposes) {
        const existing = configs.find((c) => c.provider === provider && c.purpose === purpose);
        const response = await fetch("/api/settings/ai-provider-configs", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            organizationId,
            purpose,
            provider,
            model: purpose === "stt" ? sttModel : model,
            apiKey: apiKey || undefined,
            baseUrl: baseUrl || undefined,
            enabled,
            keepExistingKey: !apiKey && Boolean(existing?.hasApiKey),
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message ?? "Save failed.");
      }
      setApiKey("");
      // Reload
      const refreshed = await Promise.all(
        purposes.map((p) =>
          fetch(`/api/settings/ai-provider-configs?purpose=${p}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
            .then(async (r) => {
              const body = await r.json().catch(() => null) as { configs?: Config[]; message?: string } | null;
              if (!r.ok) throw new Error(body?.message ?? "Provider configs could not reload.");
              return body?.configs ?? [];
            })
        ),
      );
      setConfigs(refreshed.flat());
      setCatalogVersion((n) => n + 1);
      setNotice("Provider settings saved. Secret values are never returned to the browser.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provider settings could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProvider() {
    if (!confirm(`Remove the saved ${provider} configuration for this purpose? This deletes the encrypted API key.`)) return;
    setSaving(true); setNotice(""); setError("");
    try {
      const purposes = tab === "voice-chat" ? ["tts", "stt"] : [PURPOSE_FOR_TAB[tab]];
      for (const purpose of purposes) {
        const response = await fetch(`/api/settings/ai-provider-configs?purpose=${purpose}&provider=${provider}&organizationId=${encodeURIComponent(organizationId)}`, {
          method: "DELETE",
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(body?.message || `Could not remove the ${purpose} configuration (HTTP ${response.status}). Other capabilities may have been changed; reload to review.`);
        }
      }
      setNotice("Provider config removed.");
      setApiKey("");
      const refreshed = await Promise.all(
        purposes.map((p) =>
          fetch(`/api/settings/ai-provider-configs?purpose=${p}&organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" })
            .then(async (r) => {
              const body = await r.json().catch(() => null) as { configs?: Config[]; message?: string } | null;
              if (!r.ok) throw new Error(body?.message ?? "Provider configs could not reload.");
              return body?.configs ?? [];
            })
        ),
      );
      setConfigs(refreshed.flat());
      // Drop any catalogue fetched using credentials that were just removed.
      setCatalogVersion((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove provider config.");
    } finally {
      setSaving(false);
    }
  }

  const current = configs.find((c) => c.provider === provider && c.purpose === PURPOSE_FOR_TAB[tab]);
  const inputCls = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm";
  const labelCls = "block text-sm font-medium";

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      {/* Status badges */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ALLOWED_PROVIDERS[tab].map((p) => {
          const cfg = configs.find((c) => c.provider === p);
          const Icon = cfg?.enabled && cfg?.hasApiKey ? CheckCircle2 : AlertCircle;
          const color = cfg?.enabled && cfg?.hasApiKey ? "text-emerald-600" : "text-amber-500";
          return (
            <div
              key={p}
              className={
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs " +
                (p === provider ? "border-primary bg-muted/30" : "border-border bg-background")
              }
            >
              <Icon className={"h-3.5 w-3.5 " + color} />
              <span className="font-medium">{PROVIDER_LABELS[p] || p}</span>
              <span className="text-muted-foreground">
                {cfg?.hasApiKey ? (cfg?.enabled ? "active" : "saved (disabled)") : "not configured"}
              </span>
              <button
                type="button"
                className="ml-auto rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                onClick={() => chooseProvider(p)}
              >
                select
              </button>
            </div>
          );
        })}
      </div>

      {notice ? (
        <p role="status" className="rounded-md border bg-muted/40 p-3 text-sm">{notice}</p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading provider configuration…
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <label className={labelCls}>
              Provider
              <select className={inputCls} value={provider} onChange={(e) => chooseProvider(e.target.value)}>
                {ALLOWED_PROVIDERS[tab].map((p) => (
                  <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>
                ))}
              </select>
            </label>
            <div className="rounded-md border border-border p-3 text-sm">
              <span className="font-medium">{PROVIDER_LABELS[provider] || provider} status: </span>
              {current?.hasApiKey ? (current?.enabled ? "API key saved (active)" : "API key saved (disabled)") : "Not configured"}
            </div>
            <label className={labelCls}>
              API key
              <input
                className={inputCls}
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={current?.hasApiKey ? "Leave blank to keep current key" : "Enter provider API key"}
              />
            </label>
            <label className={labelCls}>
              API base URL
              <input
                className={inputCls}
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={PROVIDER_BASE_URLS[provider] || "http://localhost:8080"}
                disabled={!PROVIDER_BASE_URLS[provider] && provider !== "tei"}
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className={labelCls}>
              {tab === "voice-chat" ? "Text-to-speech model" : "Model"}
              <LiveModelSelect organizationId={organizationId} provider={provider}
                purpose={PURPOSE_FOR_TAB[tab] as ModelPurpose} value={model || null}
                onChange={(next) => setModel(next || "")} refreshKey={catalogVersion} className={inputCls} />
            </div>
            {tab === "voice-chat" ? (
              <div className={labelCls}>
                Speech-to-text model
                <LiveModelSelect organizationId={organizationId} provider={provider}
                  purpose="stt" value={sttModel || null} onChange={(next) => setSttModel(next || "")}
                  refreshKey={catalogVersion} className={inputCls} />
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Models come only from the provider's live API using the saved, organization-scoped key.
              Save the key first, then select a model and save again. Providers without a listing API cannot show a fabricated list.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enable this provider
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveProvider()}
                disabled={saving}
                className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save provider"}
              </button>
              {current?.hasApiKey ? (
                <button
                  type="button"
                  onClick={() => void deleteProvider()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              ) : null}
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Keys are envelope-encrypted (AES-256-GCM) with CREDENTIALS_MASTER_KEY and stored as <code>encrypted_api_key</code> on <code>ai_provider_configs</code>. They are never returned to the browser.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
