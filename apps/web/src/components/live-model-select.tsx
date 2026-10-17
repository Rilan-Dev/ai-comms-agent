"use client";

import { useEffect, useState } from "react";

export type ModelPurpose = "chat" | "embedding" | "realtime" | "tts" | "stt";
type ModelOption = { id: string; name: string };

/** One catalog UI for organization defaults and per-agent overrides. */
export function LiveModelSelect({
  organizationId, provider, purpose, value, onChange,
  allowInherit = false, refreshKey = 0, className = "",
}: {
  organizationId: string;
  provider: string;
  purpose: ModelPurpose;
  value: string | null;
  onChange: (model: string | null) => void;
  allowInherit?: boolean;
  refreshKey?: number;
  className?: string;
}) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!organizationId || !provider) {
      setModels([]);
      setLoading(false);
      setMessage(!organizationId ? "Select an organization first." : "Select a provider first.");
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setMessage("");
    setModels([]);
    const params = new URLSearchParams({ organizationId, provider, purpose });
    void fetch(`/api/settings/ai-models?${params}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      const body = await response.json() as { models?: ModelOption[]; message?: string; source?: string };
      // A previous organization's fulfilled response may arrive after its request was aborted.
      // Never display its model IDs in the newly selected organization's form.
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(body.message || "Live models could not be fetched.");
      if (body.source !== "live") throw new Error("The provider did not return a live catalogue.");
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
        aria-label={`${provider} ${purpose} model from live provider catalogue`}
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
      ) : <p className="text-xs text-muted-foreground">{models.length} provider-advertised models · live API</p>}
      {savedId && !available && !loading ? (
        <p role="status" className="text-xs text-amber-700">
          Previously saved model “{savedId}” is not in the current live list. Select an available model when the catalogue loads.
        </p>
      ) : null}
    </div>
  );
}
