"use client";

import { useEffect, useState } from "react";
import { modelCatalogRecovery, type CatalogRecovery } from "@/lib/ai/model-catalog-recovery";

export type ModelPurpose = "chat" | "embedding" | "realtime" | "tts" | "stt";
type ModelOption = { id: string; name: string };

/** One catalog UI for organization defaults and per-agent overrides. */
export function LiveModelSelect({
  organizationId, provider, purpose, value, onChange,
  allowInherit = false, refreshKey = 0, className = "",
  onReuseSavedRealtimeKey, reuseCredentialBusy = false,
}: {
  organizationId: string;
  provider: string;
  purpose: ModelPurpose;
  value: string | null;
  onChange: (model: string | null) => void;
  allowInherit?: boolean;
  refreshKey?: number;
  className?: string;
  /** Explicit administrator-initiated reuse; server authorizes the mutation. */
  onReuseSavedRealtimeKey?: () => void;
  reuseCredentialBusy?: boolean;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [recovery, setRecovery] = useState<CatalogRecovery>(null);
  const [catalogNote, setCatalogNote] = useState("");
  const [catalogSource, setCatalogSource] = useState<"live" | "documented" | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!organizationId || !provider) {
      setModels([]);
      setLoading(false);
      setMessage(!organizationId ? "Select an organization first." : "Select a provider first.");
      setRecovery(null);
      setCatalogSource(null);
      setCatalogNote("");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setMessage("");
    setRecovery(null);
    setCatalogNote("");
    setCatalogSource(null);
    setModels([]);
    const params = new URLSearchParams({ organizationId, provider, purpose });
    void fetch(`/api/settings/ai-models?${params}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as {
        models?: ModelOption[]; message?: string; error?: string;
        canReuseRealtimeKey?: boolean; source?: string; capability?: string;
      };
      // A previous organization's fulfilled response may arrive after its request was aborted.
      // Never display its model IDs in the newly selected organization's form.
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setRecovery(modelCatalogRecovery({ provider, purpose, error: body.error, canReuseRealtimeKey: body.canReuseRealtimeKey }));
        throw new Error(body.message || "Live models could not be fetched.");
      }
      if (body.source !== "live" && body.source !== "documented") throw new Error("The provider did not return a supported model catalogue.");
      if (body.source === "documented" && (purpose !== "realtime" || !["sarvam", "elevenlabs"].includes(provider) || body.capability !== "streaming_stt")) {
        throw new Error("The provider returned an unexpected documented capability.");
      }
      setCatalogSource(body.source);
      if (body.source === "documented") setCatalogNote(body.message || "Vendor-documented streaming STT models; availability is verified only when the voice session connects.");
      setModels(body.models ?? []);
      if (!body.models?.length) setMessage("The provider returned no compatible models for this capability.");
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setMessage(err instanceof Error ? err.message : "Live models could not be fetched.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [organizationId, provider, purpose, refreshKey, retry]);

  const savedId = value || "";
  const available = models.some((model) => model.id === savedId);
  const selectableValue = available ? savedId : "";
  return (
    <div className="space-y-1">
      <select
        aria-label={`${provider} ${purpose} ${catalogSource === "documented" ? "streaming STT model from vendor documentation" : "model from live provider catalogue"}`}
        className={className}
        value={selectableValue}
        disabled={loading || models.length === 0}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">{allowInherit ? "(inherit organization default)" : "(select a live model)"}</option>
        {models.map((model) => <option key={model.id} value={model.id}>{model.name === model.id ? model.id : `${model.name} — ${model.id}`}</option>)}
      </select>
      {loading ? <p className="text-xs text-muted-foreground">Loading live models…</p> : null}
      {message ? (
        <p role="status" className="text-xs text-amber-700">
          {message}{" "}
          <button type="button" className="underline" onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </p>
      ) : catalogSource === "documented" ? (
        <p className="text-xs text-muted-foreground">{models.length} vendor-documented streaming STT {models.length === 1 ? "model" : "models"} · not a live per-account model listing</p>
      ) : <p className="text-xs text-muted-foreground">{models.length} provider-advertised models · live API</p>}
      {recovery === "reuse-realtime" ? (
        <button
          type="button"
          disabled={reuseCredentialBusy || !onReuseSavedRealtimeKey}
          onClick={onReuseSavedRealtimeKey}
          className="rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary disabled:opacity-50"
        >
          {reuseCredentialBusy ? "Configuring voice credentials…" : "Use saved Realtime key for TTS/STT"}
        </button>
      ) : null}
      {recovery === "configure-capability" ? (
        <p className="text-xs text-muted-foreground">
          Configure and enable the ElevenLabs TTS and STT credentials in Voice Chat above, then retry.
          A Realtime key is not automatically shared across capabilities.
        </p>
      ) : null}
      {recovery === "contact-admin" ? (
        <p className="text-xs text-muted-foreground">
          The saved credential cannot be decrypted on the server. Ask an administrator to verify the encryption configuration.
        </p>
      ) : null}
      {catalogNote ? <p role="status" className="text-xs text-muted-foreground">{catalogNote}</p> : null}
      {savedId && !available && !loading ? (
        <p role="status" className="text-xs text-amber-700">
          Previously saved model “{savedId}” is not supported by the current {catalogSource === "documented" ? "streaming voice transport" : "live catalogue"}. Choose a supported option, then save. Existing settings are not changed automatically.
        </p>
      ) : null}
    </div>
  );
}
