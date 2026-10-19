"use client";

import { useCallback, useEffect, useState } from "react";

type Config = {
  id: string; label: string; clientId: string; tenantId: string;
  enabled: boolean; redirectUri: string; secretConfigured: boolean;
};

export function MicrosoftOAuthSettings({ organizationId }: { organizationId: string }) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [editingId, setEditingId] = useState("");
  const [label, setLabel] = useState("");
  const [clientId, setClientId] = useState("");
  const [tenantId, setTenantId] = useState("common");
  const [clientSecret, setClientSecret] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const response = await fetch("/api/settings/microsoft-oauth?organizationId=" + encodeURIComponent(organizationId), {
        cache: "no-store", signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Microsoft OAuth configurations could not be loaded.");
      if (!signal?.aborted) setConfigs(data.configurations ?? []);
    } catch (error) {
      if (!signal?.aborted) setNotice(error instanceof Error ? error.message : "Could not load Microsoft clients.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [organizationId]);
  useEffect(() => {
    const controller = new AbortController();
    setConfigs([]); setEditingId(""); setClientSecret(""); setShowForm(false);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function edit(config?: Config) {
    setEditingId(config?.id ?? "");
    setLabel(config?.label ?? "");
    setClientId(config?.clientId ?? "");
    setTenantId(config?.tenantId ?? "common");
    setEnabled(config?.enabled ?? true);
    setClientSecret(""); setNotice(""); setShowForm(true);
  }

  async function save() {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/settings/microsoft-oauth", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, id: editingId || undefined, label, clientId, tenantId, clientSecret, enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Microsoft client could not be saved.");
      setClientSecret(""); setShowForm(false); setNotice("Microsoft OAuth client saved. No application rebuild is needed.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Microsoft client could not be saved.");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this Microsoft OAuth client? Connected accounts may need reconnection.")) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/settings/microsoft-oauth", {
        method: "DELETE", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, id }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not remove Microsoft client.");
      setNotice("Microsoft OAuth client removed.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove Microsoft client."); }
    finally { setBusy(false); }
  }

  return <section aria-label="Microsoft OAuth clients" className="rounded-md border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Microsoft Graph / Outlook clients</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Create an application in Microsoft Entra, register the callback URL, and save the client ID, tenant and secret here. Only admins can view and change client settings; stored secrets never return to this page.</p>
      </div>
      <button type="button" disabled={!organizationId || loading} onClick={() => edit()}
        className="rounded-md border px-3 py-2 text-sm font-semibold hover:bg-secondary disabled:opacity-50">Add Microsoft client</button>
    </div>
    {notice ? <p role="status" className="mt-3 rounded-md bg-muted p-3 text-xs">{notice}</p> : null}
    {loading ? <p role="status" className="mt-3 text-xs text-muted-foreground">Loading clients…</p> :
      <div className="mt-4 space-y-2">{configs.length === 0 ? <p className="text-xs text-muted-foreground">No Microsoft client configured yet.</p> : configs.map((config) =>
        <div key={config.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{config.label} <span className="text-xs text-muted-foreground">· {config.enabled ? "Enabled" : "Disabled"}</span></p>
            <p className="mt-1 break-all text-xs text-muted-foreground">Tenant: {config.tenantId} · Client: {config.clientId}</p>
          </div>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => edit(config)} className="rounded-md border px-3 py-2 text-xs font-medium">Edit</button>
            <button disabled={busy} onClick={() => void remove(config.id)} className="rounded-md border px-3 py-2 text-xs font-medium text-destructive">Remove</button>
          </div>
        </div>)}</div>}
    {showForm ? <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="mt-5 grid gap-3 rounded-md border border-border bg-muted/20 p-4 sm:grid-cols-2">
      <label className="text-xs font-medium">Client label<input required maxLength={100} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Company Microsoft 365" className="mt-1 block h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
      <label className="text-xs font-medium">Entra application (client) ID<input required value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1 block h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
      <label className="text-xs font-medium">Tenant ID / audience<input required value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="common or tenant UUID" className="mt-1 block h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
      <label className="text-xs font-medium">Client secret{editingId ? " (leave blank to retain)" : ""}
        <input type="password" required={!editingId} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password"
          className="mt-1 block h-11 w-full rounded-md border bg-background px-3 text-sm"/></label>
      <div className="sm:col-span-2 text-xs text-muted-foreground">
        <p className="font-medium">Microsoft Entra web redirect URI:</p>
        <code className="mt-1 block break-all rounded bg-background p-2">{configs[0]?.redirectUri || "/api/oauth/microsoft/callback (resolved from the current public HTTPS origin)"}</code>
        <p className="mt-1">Configure delegated Mail.Read and offline_access permissions for the registered application.</p>
      </div>
      <label className="sm:col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}/> Enable client
      </label>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button disabled={busy || loading} type="submit" className="rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{busy ? "Saving…" : "Save Microsoft client"}</button>
        <button type="button" onClick={() => { setShowForm(false); setClientSecret(""); }} className="rounded-md border px-4 py-2.5 text-sm">Cancel</button>
      </div>
    </form> : null}
  </section>;
}
