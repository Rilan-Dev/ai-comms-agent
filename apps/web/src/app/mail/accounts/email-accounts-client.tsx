"use client";

import { useEffect, useState } from "react";
import type { EmailAccount } from "@ai-comms-agent/shared";

const providers = [
  { id: "gmail", name: "Gmail", description: "Google Workspace and Gmail", method: "OAuth 2.0", tone: "G" },
  { id: "zoho", name: "Zoho Mail", description: "Regional Zoho Mail endpoints", method: "OAuth 2.0", tone: "Z" },
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
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImapForm, setShowImapForm] = useState(false);
  const [imap, setImap] = useState({email:"",displayName:"",host:"",port:"993",username:"",password:"",smtpHost:"",smtpPort:"465",tls:true});
  const [savingImap, setSavingImap] = useState(false);
  const [imapError, setImapError] = useState<string | null>(null);
  const [testingImap, setTestingImap] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "gmail") setNotice("Gmail authorization completed. The account is pending worker verification and initial synchronization.");
    if (params.get("connected") === "zoho") setNotice("Zoho authorization completed. The account is pending worker verification and initial synchronization.");
  }, []);

  async function reconnect(account: EmailAccount) {
    if (account.provider === "gmail") {
      window.location.assign("/api/oauth/gmail/start");
      return;
    }
    if (account.provider === "zoho") {
      window.location.assign("/api/oauth/zoho/start");
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
    <main className="mx-auto max-w-[1200px] space-y-8 p-5 sm:p-7 lg:p-9">
      <header className="flex flex-col gap-5 border-b pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mail / Connections</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Email accounts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Connect the mailboxes your agents can work with. Credentials remain server-side and are never rendered into this UI.
          </p>
        </div>
        <div className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
          <span className="font-semibold">{accounts.length}</span>
          <span className="ml-1 text-muted-foreground">connected records</span>
        </div>
      </header>

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-2xl border bg-muted/50 px-4 py-3 text-sm">
          <span>{notice}</span>
          <button className="font-semibold underline underline-offset-4" onClick={() => setNotice(null)}>Dismiss</button>
        </div>
      )}

      {showImapForm && (
        <section className="rounded-3xl border bg-background p-6 shadow-sm sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Configure IMAP / SMTP</h2><p className="mt-1 text-sm text-muted-foreground">TLS is mandatory. Credentials are encrypted server-side and never returned to the browser after submission.</p></div><button type="button" onClick={()=>setShowImapForm(false)} className="text-sm font-semibold text-muted-foreground hover:text-foreground">Close</button></div>
          <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={async(e)=>{e.preventDefault();setSavingImap(true);setNotice(null);setImapError(null);try{const response=await fetch("/api/email-accounts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({organizationId,action:"connect_imap_smtp",emailAddress:imap.email,displayName:imap.displayName,host:imap.host,port:Number(imap.port),username:imap.username,password:imap.password,smtpHost:imap.smtpHost||imap.host,smtpPort:Number(imap.smtpPort),tls:imap.tls})});const data=await response.json();if(!response.ok)throw new Error(data.message??Object.values(data.fieldErrors??{}).join(" "));setAccounts((current)=>[data.account,...current]);setNotice("Mailbox configuration saved securely. It is pending worker verification and mailbox structure discovery.");setShowImapForm(false);}catch(error){const message=error instanceof Error?error.message:"Could not save mailbox configuration.";setImapError(message);setNotice("Mailbox configuration could not be saved.");}finally{setSavingImap(false);}}}>
            <label className="text-sm font-medium">Email address<input required type="email" value={imap.email} onChange={e=>setImap({...imap,email:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">Display name<input value={imap.displayName} onChange={e=>setImap({...imap,displayName:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">IMAP host<input required value={imap.host} onChange={e=>setImap({...imap,host:e.target.value})} placeholder="imap.example.com" className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">IMAP port<input required type="number" min="1" max="65535" value={imap.port} onChange={e=>setImap({...imap,port:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">SMTP host<input required value={imap.smtpHost} onChange={e=>setImap({...imap,smtpHost:e.target.value})} placeholder="smtp.example.com" className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">SMTP port<input required type="number" min="1" max="65535" value={imap.smtpPort} onChange={e=>setImap({...imap,smtpPort:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">Username<input required value={imap.username} onChange={e=>setImap({...imap,username:e.target.value})} className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="text-sm font-medium">Password / app password<input required type="password" value={imap.password} onChange={e=>setImap({...imap,password:e.target.value})} autoComplete="new-password" className="mt-1 h-11 w-full rounded-xl border px-3 text-sm" /></label>
            <label className="flex items-center gap-3 text-sm md:col-span-2"><input type="checkbox" checked={imap.tls} onChange={e=>setImap({...imap,tls:e.target.checked})} /> Require TLS for both IMAP and SMTP</label>
            {imapError && <p role="alert" className="md:col-span-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{imapError}</p>}
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
              }} className="h-10 rounded-xl border px-5 text-sm font-semibold disabled:opacity-50">{testingImap ? "Testing…" : "Test connection"}</button>
              <button disabled={savingImap || testingImap} className="h-10 rounded-xl bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">{savingImap ? "Saving…" : "Save mailbox"}</button>
            </div>
          </form>
        </section>
      )}

      <section className="grid gap-4 lg:grid-cols-3" aria-label="Email providers">
        {providers.map((provider) => (
          <article key={provider.id} className="group rounded-3xl border bg-background p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <div className="grid size-11 place-items-center rounded-2xl bg-muted font-semibold">{provider.tone}</div>
              <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">Secure connection</span>
            </div>
            <h2 className="mt-5 text-base font-semibold">{provider.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{provider.description}</p>
            <p className="mt-4 text-xs font-medium text-muted-foreground">{provider.method}</p>
            <button
              type="button"
              onClick={() => {
                if (provider.id === "gmail") window.location.assign("/api/oauth/gmail/start");
                if (provider.id === "zoho") window.location.assign("/api/oauth/zoho/start");
                if (provider.id === "imap_smtp") setShowImapForm(true);
              }}
              className="mt-5 h-10 w-full rounded-xl border bg-muted/40 text-sm font-semibold transition hover:bg-muted"
            >
              {provider.id === "gmail" ? "Connect with Google" : provider.id === "zoho" ? "Connect with Zoho" : "Configure mailbox"}
            </button>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl border bg-background shadow-sm">
        <div className="border-b px-5 py-5 sm:px-6">
          <h2 className="font-semibold">Connected mailboxes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Only persisted account state is shown here.</p>
        </div>
        {accounts.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-lg">✉</div>
            <h3 className="mt-4 font-semibold">No mailboxes connected</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Provider setup is configuration-driven. OAuth accounts remain pending until the worker verifies credentials and discovers mailbox structure; IMAP/SMTP is tested before credentials are persisted.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {accounts.map((account) => (
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
                </div>
                <div className="flex flex-wrap gap-2">
                  {account.status !== "connected" && account.status !== "disconnected" && (
                    <button type="button" disabled={busy === account.id} onClick={() => reconnect(account)} className="h-10 rounded-xl border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Reconnecting…" : "Reconnect"}
                    </button>
                  )}
                  {account.status === "connected" && account.provider === "imap_smtp" && (
                    <button type="button" disabled={busy === account.id} onClick={() => reconnect(account)} className="h-10 rounded-xl border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Checking…" : "Test connection"}
                    </button>
                  )}
                  {account.status !== "disconnected" && (
                    <button type="button" disabled={busy === account.id} onClick={() => disconnect(account.id)} className="h-10 rounded-xl border px-4 text-sm font-semibold transition hover:bg-muted disabled:opacity-50">
                      {busy === account.id ? "Disconnecting…" : "Disconnect"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
