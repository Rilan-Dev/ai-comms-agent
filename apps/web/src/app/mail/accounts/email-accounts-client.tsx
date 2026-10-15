"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmailAccount } from "@ai-comms-agent/shared";

const providers = [
  { id: "gmail", name: "Gmail", description: "Google Workspace and Gmail", method: "OAuth 2.0", tone: "G" },
  { id: "zoho", name: "Zoho Mail", description: "Regional Zoho Mail endpoints", method: "OAuth 2.0", tone: "Z" },
  { id: "microsoft_graph", name: "Outlook / Microsoft 365", description: "Outlook.com and Microsoft 365 mailboxes", method: "Microsoft OAuth 2.0", tone: "M" },
  { id: "imap_smtp", name: "IMAP / SMTP", description: "Any compatible mailbox", method: "TLS · OAuth or app password", tone: "M" },
] as const;

function statusLabel(status: EmailAccount["status"]) {
  return {
    connected: "Connected",
    pending: "Pending",
    revoked: "Revoked",
    error: "Needs attention",
    disconnected: "Disconnected",
  }[status];
}

export function EmailAccountsClient({
  organizationId,
  initialAccounts,
}: {
  organizationId: string;
  initialAccounts: EmailAccount[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [gmailConfigs, setGmailConfigs] = useState<Array<{ id: string; label: string; enabled: boolean }>>([]);
  const [selectedGmailConfig, setSelectedGmailConfig] = useState("");
  const [zohoConfigs, setZohoConfigs] = useState<Array<{ id: string; label: string; enabled: boolean }>>([]);
  const [selectedZohoConfig, setSelectedZohoConfig] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [zohoWebhookUrls, setZohoWebhookUrls] = useState<Record<string, string>>({});
  const [showImapForm, setShowImapForm] = useState(false);
  const [imap, setImap] = useState({email:"",displayName:"",host:"",port:"993",username:"",password:"",smtpHost:"",smtpPort:"465",tls:true});
  const [savingImap, setSavingImap] = useState(false);
  const [imapError, setImapError] = useState<string | null>(null);
  const [testingImap, setTestingImap] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EmailAccount["status"]>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [structureLoading, setStructureLoading] = useState<string | null>(null);
  const [structureByAccount, setStructureByAccount] = useState<Record<string, {
    folders: Array<{ id: string; name: string; role: string; unread_count: number }>;
    labels: Array<{ id: string; name: string; label_type: string }>;
    agents: Array<{ id: string; name: string; slug: string; role: string }>;
  }>>({});
  const filteredAccounts = useMemo(() => { const q = query.trim().toLowerCase(); return accounts.filter((a) => (statusFilter === "all" || a.status === statusFilter) && (!q || [a.email_address, a.display_name, a.provider].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)))); }, [accounts, query, statusFilter]);
  async function refreshAccounts() { setRefreshing(true); try { const response = await fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Could not refresh email accounts."); setAccounts(data.accounts ?? []); setNotice("Mailbox status refreshed."); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not refresh email accounts."); } finally { setRefreshing(false); } }

  useEffect(() => {
    void fetch("/api/settings/gmail-oauth?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) return; const configs = (body.configurations ?? []).filter((item: { enabled: boolean }) => item.enabled); setGmailConfigs(configs); setSelectedGmailConfig((current) => current || configs[0]?.id || ""); })
      .catch(() => undefined);
  }, [organizationId]);

  useEffect(() => {
    void fetch("/api/settings/zoho-oauth?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" })
      .then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) return; const configs = (body.configurations ?? []).filter((item: { enabled: boolean }) => item.enabled); setZohoConfigs(configs); setSelectedZohoConfig((current) => current || configs[0]?.id || ""); })
      .catch(() => undefined);
  }, [organizationId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "gmail") setNotice("Gmail authorization completed. The account is pending worker verification and initial synchronization.");
    if (params.get("connected") === "zoho") setNotice("Zoho authorization completed. The account is pending worker verification and initial synchronization.");
    if (params.get("connected") === "microsoft_graph") setNotice("Outlook authorization completed. The account is pending worker verification and initial synchronization.");
    if (params.get("providerError")) setNotice(params.get("providerError"));
    if (params.has("connected") || params.has("providerError")) {
      window.history.replaceState({}, "", "/mail/accounts");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        setAccounts(data.accounts ?? []);
      } catch {
        // Keep the last persisted snapshot visible during transient refresh failures.
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [organizationId]);

  async function syncNow(account: EmailAccount) {
    setBusy(account.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/email-accounts/${encodeURIComponent(account.id)}/sync`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Mailbox synchronization could not be queued.");
      setNotice(data.message ?? "Mailbox sync queued.");
      const refresh = await fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
      if (refresh.ok) {
        const snapshot = await refresh.json();
        setAccounts(snapshot.accounts ?? []);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mailbox synchronization could not be queued.");
    } finally {
      setBusy(null);
    }
  }

  async function generateZohoWebhookUrl(account: EmailAccount) {
    setBusy(account.id);
    setNotice(null);
    try {
      const response = await fetch(`/api/email-accounts/${encodeURIComponent(account.id)}/zoho-webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message ?? "Could not generate the Zoho webhook URL.");
      setZohoWebhookUrls((current) => ({ ...current, [account.id]: data.webhookUrl }));
      setNotice("One-time Zoho webhook URL generated. Copy it now and configure it in Zoho Mail; it cannot be retrieved after leaving this page.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not generate the Zoho webhook URL.");
    } finally {
      setBusy(null);
    }
  }

  async function reconnect(account: EmailAccount) {
    if (account.provider === "gmail") {
      if (!selectedGmailConfig) { setNotice("Add and enable a Gmail OAuth client in Settings before connecting Gmail."); return; }
      window.location.assign(`/api/oauth/gmail/start?configId=${encodeURIComponent(selectedGmailConfig)}&accountId=${encodeURIComponent(account.id)}`);
      return;
    }
    if (account.provider === "zoho") {
      if (!selectedZohoConfig) { setNotice("Add and enable a Zoho OAuth client in Settings before reconnecting Zoho Mail."); return; }
      window.location.assign(`/api/oauth/zoho/start?configId=${encodeURIComponent(selectedZohoConfig)}&accountId=${encodeURIComponent(account.id)}`);
      return;
    }
    if (account.provider === "microsoft_graph") {
      window.location.assign(`/api/oauth/microsoft/start?accountId=${encodeURIComponent(account.id)}`);
      return;
    }
    setBusy(account.id);
    setNotice(null);
    try {
      const response = await fetch("/api/email-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, accountId: account.id, action: "reconnect_imap_smtp" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not reconnect the mailbox.");
      setAccounts((current) => current.map((item) => item.id === account.id ? data.account : item));
      setNotice("Mailbox connection verified and restored.");
      await refreshAccounts();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Mailbox reconnection failed.");
      const response = await fetch("/api/email-accounts?organizationId=" + encodeURIComponent(organizationId));
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.accounts ?? []);
      }
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(account: EmailAccount) {
    if (!window.confirm("Permanently remove " + account.email_address + "? Synced mail and account credentials for this mailbox will also be removed.")) return;
    setBusy(account.id); setNotice(null);
    try {
      const response = await fetch("/api/email-accounts", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, accountId: account.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not remove the mailbox.");
      setAccounts((current) => current.filter((item) => item.id !== account.id));
      setNotice("Mailbox removed. Stored mailbox data and credentials were deleted.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not remove the mailbox."); }
    finally { setBusy(null); }
  }

  async function loadStructure(accountId: string) {
    setStructureLoading(accountId);
    try {
      const response = await fetch(`/api/email-accounts/${encodeURIComponent(accountId)}/structure?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not load mailbox structure.");
      setStructureByAccount((current) => ({ ...current, [accountId]: {
        folders: data.folders ?? [],
        labels: data.labels ?? [],
        agents: data.agents ?? [],
      }}));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not load mailbox structure.");
    } finally {
      setStructureLoading(null);
    }
  }

  async function disconnect(accountId: string) {
    if (!window.confirm("Disconnect this mailbox? Existing synced mail will remain stored.")) return;
    setBusy(accountId);
    setNotice(null);
    try {
      const response = await fetch("/api/email-accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, accountId, action: "disconnect" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Could not disconnect the mailbox.");
      setAccounts((current) => current.map((account) => account.id === accountId ? data.account : account));
      setNotice("Mailbox disconnected. Stored messages were preserved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not disconnect the mailbox.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1200px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-5 border-b pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mail / Connections</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Email accounts<span className="text-tertiary">.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Connect the mailboxes your agents can work with. Credentials remain server-side and are never rendered into this UI.
          </p>
        </div>
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-semibold">{accounts.length}</span>
          <span className="ml-1 text-muted-foreground">mailboxes</span>
        </div>
      </header>

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-3 text-sm">
          <span>{notice}</span>
          <button className="font-semibold underline underline-offset-4" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      {showImapForm && (
        <section className="rounded-md border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Configure IMAP / SMTP</h2><p className="mt-1 text-sm text-muted-foreground">TLS is mandatory. Credentials are encrypted server-side and never returned to the browser after submission.</p></div><button type="button" onClick={()=>setShowImapForm(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Close</button></div>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={async(e)=>{e.preventDefault();setSavingImap(true);setNotice(null);setImapError(null);try{const response=await fetch("/api/email-accounts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,action:"connect_imap_smtp",emailAddress:imap.email,displayName:imap.displayName,host:imap.host,port:Number(imap.port),username:imap.username,password:imap.password,smtpHost:imap.smtpHost||imap.host,smtpPort:Number(imap.smtpPort),tls:imap.tls})});const data=await response.json();if(!response.ok)throw new Error(data.message??Object.values(data.fieldErrors??{}).join(" "));setAccounts((current)=>[data.account,...current]);setNotice("Mailbox configuration saved securely. It is pending worker verification and mailbox structure discovery.");setShowImapForm(false);}catch(error){const message=error instanceof Error?error.message:"Could not save mailbox configuration.";setImapError(message);setNotice("Mailbox configuration could not be saved.");}finally{setSavingImap(false);}}}>
            <label className="text-sm font-medium">Email address<input required type="email" value={imap.email} onChange={e=>setImap({...imap,email:e.target.value})} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/20" /></label>
            <label className="text-sm font-medium">Display name<input value={imap.displayName} onChange={e=>setImap({...imap,displayName:e.target.value})} className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="text-sm font-medium">IMAP host<input required value={imap.host} onChange={e=>setImap({...imap,host:e.target.value})} placeholder="imap.example.com" className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="text-sm font-medium">IMAP port<input required type="number" min="1" max="65535" value={imap.port} onChange={e=>setImap({...imap,port:e.target.value})} className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="text-sm font-medium">SMTP host<input required value={imap.smtpHost} onChange={e=>setImap({...imap,smtpHost:e.target.value})} placeholder="smtp.example.com" className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="text-sm font-medium">SMTP port<input required type="number" min="1" max="65535" value={imap.smtpPort} onChange={e=>setImap({...imap,smtpPort:e.target.value})} className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="text-sm font-medium">Username<input required value={imap.username} onChange={e=>setImap({...imap,username:e.target.value})} className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="text-sm font-medium">Password / app password<input required type="password" value={imap.password} onChange={e=>setImap({...imap,password:e.target.value})} autoComplete="new-password" className="mt-1 h-11 w-full rounded-md border px-3 text-sm" /></label>
            <label className="flex items-center gap-3 text-sm md:col-span-2"><input type="checkbox" checked={imap.tls} onChange={e=>setImap({...imap,tls:e.target.checked})} /> Require TLS for both IMAP and SMTP</label>
            {imapError && <p role="alert" className="md:col-span-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{imapError}</p>}
            <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
              <button type="button" disabled={savingImap || testingImap} onClick={async () => {
                setTestingImap(true); setImapError(null);
                try {
                  const response = await fetch("/api/email-accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
                    organizationId, action: "test_imap_smtp", emailAddress: imap.email, host: imap.host, port: Number(imap.port),
                    username: imap.username, password: imap.password, smtpHost: imap.smtpHost || imap.host, smtpPort: Number(imap.smtpPort), tls: imap.tls,
                  })});
                  const data = await response.json();
                  if (!response.ok) throw new Error(data.message ?? "Connection test failed.");
                  setNotice("IMAP and SMTP authentication succeeded. You can safely save this mailbox.");
                } catch (error) { setImapError(error instanceof Error ? error.message : "Connection test failed."); }
                finally { setTestingImap(false); }
              }} className="h-10 rounded-md border border-border px-5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50">{testingImap ? "Testing…" : "Test connection"}</button>
              <button disabled={savingImap || testingImap} className="h-10 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50">{savingImap ? "Saving…" : "Save mailbox"}</button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-3" aria-label="Email providers">
        {providers.map((provider) => (
          <article key={provider.id} className="group rounded-md border border-border bg-card p-5 transition-colors hover:bg-secondary/30">
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-md bg-muted font-semibold">{provider.tone}</div>
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Secure connection</span>
            </div>
            <h2 className="mt-5 text-base font-semibold">{provider.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
            <p className="mt-4 text-xs font-medium text-muted-foreground">{provider.method}</p>
            {provider.id === "gmail" ? (
              <label className="mt-4 grid gap-1.5 text-xs font-medium text-muted-foreground">OAuth client
                <select value={selectedGmailConfig} onChange={(event) => setSelectedGmailConfig(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground">
                  {gmailConfigs.length === 0 ? <option value="">No enabled clients — configure in Settings</option> : gmailConfigs.map((config) => <option key={config.id} value={config.id}>{config.label}</option>)}
                </select>
              </label>
            ) : provider.id === "zoho" ? (
              <label className="mt-4 grid gap-1.5 text-xs font-medium text-muted-foreground">OAuth client
                <select value={selectedZohoConfig} onChange={(event) => setSelectedZohoConfig(event.target.value)} className="h-10 rounded-md border bg-background px-3 text-sm text-foreground">
                  {zohoConfigs.length === 0 ? <option value="">No enabled clients — configure in Settings</option> : zohoConfigs.map((config) => <option key={config.id} value={config.id}>{config.label}</option>)}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              onClick={() => {
                if (provider.id === "gmail") { if (!selectedGmailConfig) { setNotice("Add and enable a Gmail OAuth client in Settings before connecting Gmail."); return; } window.location.assign(`/api/oauth/gmail/start?configId=${encodeURIComponent(selectedGmailConfig)}`); }
                if (provider.id === "zoho") { if (!selectedZohoConfig) { setNotice("Add and enable a Zoho OAuth client in Settings before connecting Zoho Mail."); return; } window.location.assign(`/api/oauth/zoho/start?configId=${encodeURIComponent(selectedZohoConfig)}`); }
                if (provider.id === "microsoft_graph") window.location.assign("/api/oauth/microsoft/start");
                if (provider.id === "imap_smtp") setShowImapForm(true);
              }}
              disabled={(provider.id === "gmail" && !selectedGmailConfig) || (provider.id === "zoho" && !selectedZohoConfig)}
              className="mt-5 h-10 w-full rounded-md border bg-muted/40 text-sm font-semibold transition hover:bg-muted disabled:opacity-50"
            >
              {provider.id === "gmail" ? "Connect with Google" : provider.id === "zoho" ? "Connect with Zoho" : "Configure mailbox"}
            </button>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="border-b px-5 py-5 sm:px-6">
          <div><h2 className="font-semibold">Connected mailboxes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Live persisted state only. Credentials never leave the server.</p></div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="mailbox-search">Search mailboxes</label><input id="mailbox-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mailboxes..." className="h-10 w-full rounded-md border bg-background px-3 text-sm sm:w-56" />
            <label className="sr-only" htmlFor="mailbox-status">Filter status</label><select id="mailbox-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="h-10 rounded-md border bg-background px-3 text-sm"><option value="all">All statuses</option><option value="connected">Connected</option><option value="pending">Pending</option><option value="error">Needs attention</option><option value="disconnected">Disconnected</option><option value="revoked">Revoked</option></select>
            <button type="button" onClick={refreshAccounts} disabled={refreshing} className="h-10 rounded-md border px-4 text-sm font-semibold disabled:opacity-50">{refreshing ? "Refreshing..." : "Refresh"}</button>
          </div>
        </div>
        {accounts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-md bg-accent text-accent-foreground"><svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg></div>
            <h3 className="mt-4 font-semibold">No mailboxes connected</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Provider setup is configuration-driven. OAuth accounts remain pending until the worker verifies credentials and discovers mailbox structure; IMAP/SMTP is tested before credentials are persisted.
            </p>
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="px-6 py-14 text-center"><h3 className="font-semibold">No matching mailboxes</h3><p className="mt-2 text-sm text-muted-foreground">Try a different search or status filter.</p><button type="button" onClick={() => { setQuery(""); setStatusFilter("all"); }} className="mt-4 text-sm font-semibold underline underline-offset-4">Clear filters</button></div>
        ) : (
          <div className="divide-y">
            {filteredAccounts.map((account) => {
              const structure = structureByAccount[account.id];
              return (
              <div key={account.id} className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{account.email_address}</p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">{statusLabel(account.status)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {account.provider.replace("_", " / ")} · {account.display_name ?? "Mailbox"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(account.capabilities).filter(([,enabled])=>enabled).slice(0,5).map(([key])=><span key={key} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{key.replaceAll("_"," ")}</span>)}</div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last sync: {account.last_sync_at ? new Date(account.last_sync_at).toLocaleString() : "Not synchronized"}
                  </p>
                  {account.last_error && <p role="alert" className="mt-2 max-w-2xl text-xs text-destructive">{account.last_error}</p>}
                  {structure && (
                    <div className="mt-3 rounded-md border bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Mailbox structure</p>
                        <span className="text-[11px] text-muted-foreground">
                          Persisted discovery snapshot
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {structure.agents.map((agent) => (
                          <span key={agent.id} className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-[10px] font-semibold">
                            Agent: {agent.name} · {agent.role.replaceAll("_", " ")}
                          </span>
                        ))}
                        {structure.folders.map((folder) => (
                          <span key={folder.id} className="rounded-full border bg-background px-2 py-1 text-[10px] font-medium">
                            {folder.name}{folder.unread_count > 0 ? ` · ${folder.unread_count} unread` : ""}
                          </span>
                        ))}
                        {structure.labels.map((label) => (
                          <span key={label.id} className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium">
                            #{label.name}
                          </span>
                        ))}
                        {structure.folders.length === 0 && structure.labels.length === 0 && structure.agents.length === 0 && (
                          <span className="text-xs text-muted-foreground">No folders or labels have been discovered yet.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {["gmail", "zoho", "imap_smtp", "microsoft_graph"].includes(account.provider) && account.status !== "revoked" && account.status !== "disconnected" && (
                    <button type="button" disabled={busy === account.id} onClick={() => syncNow(account)} className="h-10 rounded-md border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Queueing…" : "Sync now"}
                    </button>
                  )}
                  {account.status !== "connected" && (
                    <button type="button" disabled={busy === account.id} onClick={() => reconnect(account)} className="h-10 rounded-md border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Reconnecting…" : "Reconnect"}
                    </button>
                  )}
                  {account.status === "connected" && (
                    <button type="button" disabled={structureLoading === account.id} onClick={() => loadStructure(account.id)} className="h-10 rounded-md border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {structureLoading === account.id ? "Loading…" : structure ? "Refresh folders" : "View folders"}
                    </button>
                  )}
                  {account.status === "connected" && account.provider === "zoho" && (
                    <button type="button" disabled={busy === account.id} onClick={() => generateZohoWebhookUrl(account)} className="h-10 rounded-md border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Generating…" : "Set up realtime webhook"}
                    </button>
                  )}
                  {account.status === "connected" && account.provider === "imap_smtp" && (
                    <button type="button" disabled={busy === account.id} onClick={() => reconnect(account)} className="h-10 rounded-md border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Checking…" : "Test connection"}
                    </button>
                  )}
                {zohoWebhookUrls[account.id] && (
                  <div className="mt-3 w-full rounded-md border bg-muted/30 p-3 sm:max-w-xl">
                    <p className="text-xs font-semibold">Zoho Mail webhook URL — shown once</p>
                    <p className="mt-1 text-xs text-muted-foreground">In Zoho Mail, open Settings → Integrations → Developer Space → Outgoing Webhooks. Choose Mail, select incoming-mail events, and use Limited Data List. Treat this URL as a secret.</p>
                    <input aria-label="Zoho webhook URL" readOnly value={zohoWebhookUrls[account.id]} className="mt-2 h-10 w-full rounded-md border bg-background px-3 font-mono text-xs" />
                    <button type="button" onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(zohoWebhookUrls[account.id]);
                        setNotice("Zoho webhook URL copied. Paste it into Zoho Mail now.");
                      } catch {
                        setNotice("Copy the URL from the field above and paste it into Zoho Mail.");
                      }
                    }} className="mt-2 h-9 rounded-md border px-3 text-xs font-semibold hover:bg-muted">Copy URL</button>
                  </div>
                )}
                  <button type="button" disabled={busy === account.id} onClick={() => deleteAccount(account)} className="h-10 rounded-md border border-destructive/30 px-4 text-sm font-semibold text-destructive transition hover:bg-destructive/5 disabled:opacity-50">
                    Remove
                  </button>
                  {account.status !== "disconnected" && (
                    <button type="button" disabled={busy === account.id} onClick={() => disconnect(account.id)} className="h-10 rounded-md border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
