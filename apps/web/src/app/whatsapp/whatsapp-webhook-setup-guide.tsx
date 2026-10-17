"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, KeyRound, Loader2, AlertCircle, Webhook, Save, RefreshCw } from "lucide-react";

export function WhatsAppWebhookSetupGuide({ organizationId, children, onVerifyTokenChange }: { organizationId: string; children?: React.ReactNode; onVerifyTokenChange?: (token: string) => void }) {
  const [origin, setOrigin] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [appSecretConfigured, setAppSecretConfigured] = useState(false);
  const [copied, setCopied] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<"unknown" | "checking" | "ok" | "fail">("unknown");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    void loadConfig();
  }, [organizationId]);

  const webhookUrl = useMemo(() => origin ? `${origin}/api/whatsapp/webhook` : "", [origin]);

  async function loadConfig() {
    try {
      const r = await fetch(`/api/whatsapp/webhook-config?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not load saved webhook settings.");
      if (d.verifyToken) { setVerifyToken(d.verifyToken); onVerifyTokenChange?.(d.verifyToken); }
      setAppSecretConfigured(Boolean(d.appSecretConfigured));
      if (d.saved) setVerifyStatus("ok");
      else { const token = generateToken(32); setVerifyToken(token); onVerifyTokenChange?.(token); }
    } catch {
      setSavedMsg("Could not load saved settings. Check your connection and try again.");
    }
  }

  async function saveConfig() {
    setSaving(true); setSavedMsg(null);
    try {
      const r = await fetch("/api/whatsapp/webhook-config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, verifyToken, appSecret }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not save webhook settings.");
      setAppSecret("");
      setAppSecretConfigured(true);
      setSavedMsg("Saved securely. Next, paste the callback URL and verify token into Meta.");
      setVerifyStatus("ok");
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : "Could not save webhook settings.");
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard(label: string, value: string) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch {
      window.prompt(`Copy ${label}:`, value);
    }
  }

  async function checkWebhookConfigured() {
    setVerifyStatus("checking");
    try {
      const url = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=setup-check`;
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      setVerifyStatus(res.status === 200 && (await res.text()) === "setup-check" ? "ok" : "fail");
    } catch {
      setVerifyStatus("fail");
    }
  }

  function regenerateToken() {
    const token = generateToken(32);
    setVerifyToken(token);
    onVerifyTokenChange?.(token);
    setVerifyStatus("unknown");
    setSavedMsg("Token changed. Save the settings and update the token in Meta again.");
  }

  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Webhook className="size-5" /></span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">WhatsApp Webhook Setup</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">Three short steps. Copy the values here, save them, then paste them into your Meta app.</p>
        </div>
      </div>

      <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${verifyStatus === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : verifyStatus === "fail" ? "border-amber-500/30 bg-amber-500/5" : "bg-muted/30"}`}>
        {verifyStatus === "checking" ? <Loader2 className="mt-0.5 size-4 animate-spin" /> : verifyStatus === "ok" ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : verifyStatus === "fail" ? <AlertCircle className="mt-0.5 size-4 text-amber-600" /> : <KeyRound className="mt-0.5 size-4 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{verifyStatus === "checking" ? "Checking your saved token…" : verifyStatus === "ok" ? "Your server accepts the saved verify token" : verifyStatus === "fail" ? "Token check failed" : "Start with the generated values below"}</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{verifyStatus === "ok" ? "This confirms the app can answer Meta's verification challenge. It does not confirm that Meta subscriptions are complete." : verifyStatus === "fail" ? "Save the settings first, and confirm this deployment URL is publicly reachable over HTTPS." : "The App Secret is never shown again after saving. You can leave it blank to keep the saved secret."}</p>
        </div>
        <button type="button" onClick={() => void checkWebhookConfigured()} disabled={!webhookUrl || !verifyToken || verifyStatus === "checking"} className="shrink-0 rounded-lg border bg-background px-3 py-2 text-xs font-medium disabled:opacity-50">Test token</button>
      </div>

      <StepBlock step={1} title="Copy the callback URL">
        <p className="text-sm leading-5 text-muted-foreground">This is where Meta sends incoming messages. It is filled in automatically for this deployment.</p>
        <CopyField label="Callback URL" value={webhookUrl} copied={copied} onCopy={copyToClipboard} />
      </StepBlock>

      <StepBlock step={2} title="Set your verification details">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">VERIFY TOKEN</label>
          <div className="flex gap-2">
            <input aria-label="Webhook verify token" value={verifyToken} onChange={e => { setVerifyToken(e.target.value); onVerifyTokenChange?.(e.target.value); setVerifyStatus("unknown"); }} className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xs" autoComplete="off" />
            <button type="button" onClick={() => copyToClipboard("Verify token", verifyToken)} className="inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"><Clipboard className="size-3.5" />{copied === "Verify token" ? "Copied" : "Copy"}</button>
            <button type="button" onClick={regenerateToken} title="Generate a new verify token" className="rounded-lg border p-2"><RefreshCw className="size-4" /></button>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Use the exact same token in this setup and in Meta's Verify Token field.</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted-foreground">META APP SECRET</label>
          <input aria-label="Meta App Secret" type="password" value={appSecret} onChange={e => setAppSecret(e.target.value)} placeholder={appSecretConfigured ? "Saved securely — leave blank to keep current secret" : "Paste from Meta App Dashboard → App settings → Basic"} autoComplete="new-password" className="h-10 w-full rounded-lg border bg-background px-3 font-mono text-xs" />
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{appSecretConfigured ? "A secret is already saved. Enter a new one only if you rotated it." : "Required for signature verification. It is encrypted before storage."}</p>
        </div>
        <button type="button" disabled={saving || !verifyToken.trim() || (!appSecret.trim() && !appSecretConfigured)} onClick={() => void saveConfig()} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}{saving ? "Saving securely…" : "Save webhook settings"}
        </button>
        {savedMsg && <p role="status" className={`text-sm leading-5 ${savedMsg.toLowerCase().includes("saved") ? "text-emerald-700" : "text-muted-foreground"}`}>{savedMsg}</p>}
      </StepBlock>

      <StepBlock step={3} title="Finish setup in Meta, then connect your phone">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-5 text-muted-foreground">
          <li>Open <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">Meta for Developers <ExternalLink className="size-3" /></a> and select the app connected to your WhatsApp Business account.</li>
          <li>Open WhatsApp → Configuration (or Webhooks), paste the Callback URL and Verify Token above, then choose <strong className="text-foreground">Verify and Save</strong>.</li>
          <li>Subscribe the app to the <code className="rounded bg-muted px-1">messages</code> webhook field. Meta's dashboard labels can vary by app setup.</li>
          <li>Return here and add the phone details below. The phone remains pending until provider verification succeeds.</li>
        </ol>
        <div className="rounded-lg border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">Keep your App Secret and access token private. Do not paste them into support messages or public logs.</div>
        {children}
      </StepBlock>
    </section>
  );
}

function StepBlock({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return <div className="space-y-3 rounded-xl border p-4 sm:p-5">
    <div className="flex items-center gap-2"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-foreground text-xs font-bold text-background">{step}</span><h3 className="text-sm font-semibold">{title}</h3></div>
    {children}
  </div>;
}

function CopyField({ label, value, copied, onCopy }: { label: string; value: string; copied: string; onCopy: (label: string, value: string) => void }) {
  return <div>
    <label className="mb-1 block text-xs font-semibold text-muted-foreground">{label.toUpperCase()}</label>
    <div className="flex gap-2">
      <input readOnly aria-label={label} value={value} onFocus={e => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 font-mono text-xs" />
      <button type="button" onClick={() => onCopy(label, value)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium">{copied === label ? <CheckCircle2 className="size-3.5" /> : <Clipboard className="size-3.5" />}{copied === label ? "Copied" : "Copy"}</button>
    </div>
  </div>;
}

function generateToken(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
