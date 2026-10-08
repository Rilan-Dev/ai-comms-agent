"use client";

import { useCallback, useEffect, useState } from "react";

type Config = { id: string; label: string; clientId: string; dataCenter: string; redirectUri: string; enabled: boolean; secretConfigured: boolean };
const centers = [
  { id: "in", label: "India (.in)" }, { id: "us", label: "United States (.com)" },
  { id: "eu", label: "Europe (.eu)" }, { id: "au", label: "Australia (.au)" },
  { id: "ca", label: "Canada (.zohocloud.ca)" }, { id: "jp", label: "Japan (.jp)" },
  { id: "sa", label: "Saudi Arabia (.sa)" },
];

export function ZohoOAuthSettings({ organizationId }: { organizationId: string }) {
  const [configs, setConfigs] = useState<Config[]>([]);
  const [label, setLabel] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [dataCenter, setDataCenter] = useState("in");
  const [editingId, setEditingId] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const response = await fetch("/api/settings/zoho-oauth?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Zoho OAuth configurations could not be loaded.");
      setConfigs(body.configurations ?? []);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not load Zoho OAuth configurations."); }
    finally { setLoading(false); }
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() { setEditingId(""); setLabel(""); setClientId(""); setClientSecret(""); setDataCenter("in"); setEnabled(true); }
  function edit(config: Config) {
    setEditingId(config.id); setLabel(config.label); setClientId(config.clientId);
    setClientSecret(""); setDataCenter(config.dataCenter); setEnabled(config.enabled);
  }
  async function save() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/settings/zoho-oauth", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, id: editingId || undefined, label, clientId, clientSecret, dataCenter, enabled }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Zoho OAuth configuration could not be saved.");
      setNotice("Zoho OAuth configuration saved securely."); resetForm(); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); }
    finally { setSaving(false); }
  }
  async function remove(config: Config) {
    if (!window.confirm("Delete Zoho OAuth client “" + config.label + "”? Existing connected mailboxes retain their encrypted account credentials, but this client cannot be selected for new connections.")) return;
    setNotice("");
    try {
      const response = await fetch("/api/settings/zoho-oauth", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, id: config.id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Configuration could not be deleted.");
      if (editingId === config.id) resetForm();
      setNotice("Zoho OAuth configuration deleted."); await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Delete failed."); }
  }

  const callback = configs[0]?.redirectUri ?? (typeof window !== "undefined" ? window.location.origin : "") + "/api/oauth/zoho/callback";
  return (
    <section className="rounded-2xl border bg-background p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Zoho OAuth clients</p>
        <h2 className="mt-1 text-lg font-semibold">Provider configurations</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Configure multiple Zoho OAuth clients by organization and data center. Client secrets are encrypted before database storage and never returned to the browser. Callback URLs follow the domain used to access this application; register the displayed callback URL in the matching Zoho API Console client.
        </p>
      </div>
      {notice ? <p role="status" className="mt-4 rounded-xl border bg-muted/30 px-4 py-3 text-sm">{notice}</p> : null}
      <p className="mt-4 break-all rounded-xl border bg-muted/20 p-3 text-xs"><strong>Current callback URI:</strong> {callback}</p>
      {callback.startsWith("http://") && !callback.includes("localhost") && !callback.includes("127.0.0.1") ? <p role="alert" className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">This is a non-local HTTP callback. Use an HTTPS domain and register the callback URI in Zoho API Console before connecting.</p> : null}
      <div className="mt-5 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">Loading configurations…</p> : configs.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No Zoho OAuth clients configured yet.</p> : configs.map((config) => (
          <div key={config.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
            <div className="min-w-0">
              <p className="font-medium">{config.label} {!config.enabled ? <span className="ml-2 text-xs text-muted-foreground">Disabled</span> : null}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">Client ID: {config.clientId}</p>
              <p className="mt-1 text-xs text-muted-foreground">Data center: {centers.find((center) => center.id === config.dataCenter)?.label ?? config.dataCenter}</p>
              <p className="mt-1 text-xs text-muted-foreground">Secret stored encrypted · not displayed</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => edit(config)} className="rounded-lg border px-3 py-2 text-sm">Edit</button>
              <button type="button" onClick={() => void remove(config)} className="rounded-lg border border-destructive/30 px-3 py-2 text-sm text-destructive">Delete</button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border p-4">
        <h3 className="font-medium">{editingId ? "Edit OAuth client" : "Add OAuth client"}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm"><span>Display name</span><input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={100} placeholder="Production Zoho client" className="h-10 rounded-lg border bg-background px-3" /></label>
          <label className="grid gap-1.5 text-sm"><span>Zoho OAuth client ID</span><input value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" placeholder="Zoho client ID" className="h-10 rounded-lg border bg-background px-3" /></label>
          <label className="grid gap-1.5 text-sm"><span>Zoho data center</span><select value={dataCenter} onChange={(e) => setDataCenter(e.target.value)} className="h-10 rounded-lg border bg-background px-3">{centers.map((center) => <option key={center.id} value={center.id}>{center.label}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm"><span>Zoho OAuth client secret {editingId ? "(leave blank to keep current secret)" : ""}</span><input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} autoComplete="new-password" placeholder={editingId ? "Leave blank to keep the saved secret" : "Paste client secret"} className="h-10 rounded-lg border bg-background px-3" /></label>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enable this client for new Zoho connections</label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" disabled={saving || !organizationId || !label.trim() || !clientId.trim() || (!editingId && !clientSecret.trim())} onClick={() => void save()} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save changes" : "Add OAuth client"}</button>
          {editingId ? <button type="button" onClick={resetForm} className="rounded-lg border px-4 py-2.5 text-sm">Cancel</button> : null}
        </div>
      </div>
    </section>
  );
}
