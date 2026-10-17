"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, KeyRound, Loader2, AlertCircle, Webhook, Save } from "lucide-react";

export function WhatsAppWebhookSetupGuide({ organizationId, children }: { organizationId: string; children?: React.ReactNode }) {
  const [origin, setOrigin] = useState<string>("");
  const [verifyToken, setVerifyToken] = useState<string>("");
  const [appSecret, setAppSecret] = useState<string>("");
  const [copied, setCopied] = useState<string>("");
  const [verifyStatus, setVerifyStatus] = useState<"unknown" | "checking" | "ok" | "missing_token" | "fail">("unknown");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      if (!verifyToken) setVerifyToken(generateToken(32));
      if (!appSecret) setAppSecret(generateToken(24));
      // Load any previously saved config
      void loadConfig();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const webhookUrl = useMemo(() => `${origin}/api/whatsapp/webhook`, [origin]);

  async function loadConfig() {
    try {
      const r = await fetch(`/api/whatsapp/webhook-config?organizationId=${encodeURIComponent(organizationId)}`, { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if (d.verifyToken) setVerifyToken(d.verifyToken);
        if (d.appSecret) setAppSecret(d.appSecret);
        if (d.saved) setVerifyStatus("ok");
      }
    } catch {}
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
      if (!r.ok) throw new Error(d.message ?? "Could not save webhook config.");
      setSavedMsg("Webhook config saved to the database. You can now configure the webhook in Meta Business Suite.");
      setVerifyStatus("ok");
    } catch (e) {
      setSavedMsg(e instanceof Error ? e.message : "Could not save webhook config.");
    } finally {
      setSaving(false);
    }
  }

  async function copyToClipboard(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt(`Copy this value (${label}):`, value);
    }
  }

  async function checkWebhookConfigured() {
    setVerifyStatus("checking");
    try {
      // Probe with the user's actual verify token — if the route returns
      // 200 + the challenge, the config is saved correctly in the DB.
      const url = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(verifyToken)}&hub.challenge=test123`;
      const res = await fetch(url, { method: "GET" });
      if (res.status === 200) {
        const body = await res.text();
        if (body === "test123") { setVerifyStatus("ok"); return; }
      }
      if (res.status === 401) { setVerifyStatus("missing_token"); return; }
      if (res.status === 503) { setVerifyStatus("missing_token"); return; }
      setVerifyStatus("fail");
    } catch {
      setVerifyStatus("fail");
    }
  }

  function regenerateToken() { setVerifyToken(generateToken(32)); }
  function regenerateSecret() { setAppSecret(generateToken(24)); }

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Webhook className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">WhatsApp Webhook Setup</h2>
          <p className="text-sm text-muted-foreground">
            Configure Meta Business Suite to push inbound WhatsApp messages to your deployment. Follow the steps below in order.
          </p>
        </div>
      </div>

      {/* Status banner */}
      <div className={`flex items-center gap-2 rounded-md border p-3 text-sm ${verifyStatus === "ok" ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700" : verifyStatus === "missing_token" || verifyStatus === "fail" ? "border-amber-500/40 bg-amber-500/5 text-amber-700" : "border-border bg-muted/40"}`}>
        {verifyStatus === "checking" ? <Loader2 className="h-4 w-4 animate-spin" /> : verifyStatus === "ok" ? <CheckCircle2 className="h-4 w-4" /> : verifyStatus === "missing_token" || verifyStatus === "fail" ? <AlertCircle className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
        <span className="flex-1">
          {verifyStatus === "checking" && "Checking webhook configuration…"}
          {verifyStatus === "ok" && "Webhook config is saved in the database. Meta can verify the webhook."}
          {verifyStatus === "missing_token" && "Webhook config is NOT saved yet. Click 'Save Webhook Config' in step 3 below."}
          {verifyStatus === "fail" && "Could not reach the webhook endpoint. Check the deployment URL."}
          {verifyStatus === "unknown" && "Click 'Check webhook status' after saving the config in step 3."}
        </span>
        <button type="button" onClick={() => void checkWebhookConfigured()} className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-secondary">Check webhook status</button>
      </div>

      {/* Step 1: Webhook URL */}
      <StepBlock step={1} title="Copy your webhook URL">
        <p className="text-sm text-muted-foreground">This URL receives POST requests from Meta when a customer messages your WhatsApp Business number. It's already live on your deployment.</p>
        <CopyField label="Webhook URL" value={webhookUrl} copied={copied} onCopy={copyToClipboard} />
      </StepBlock>

      {/* Step 2: Generate verify token + app secret */}
      <StepBlock step={2} title="Generate your Verify Token and App Secret">
        <p className="text-sm text-muted-foreground">
          The <strong>Verify Token</strong> is a shared secret you'll paste into BOTH this page (step 3) AND Meta Business Suite (step 4). The <strong>App Secret</strong> comes from your Meta App's dashboard (<code className="rounded bg-muted px-1.5 py-0.5">App Settings → Basic → App Secret</code>) — replace the placeholder below with your real App Secret.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyField label="Verify Token" value={verifyToken} copied={copied} onCopy={copyToClipboard} action={<button type="button" onClick={regenerateToken} className="ml-2 rounded border px-2 py-0.5 text-xs hover:bg-secondary">regenerate</button>} />
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">App Secret (from Meta)</label>
            <div className="mt-1 flex items-stretch gap-2">
              <input type="password" value={appSecret} onChange={e => setAppSecret(e.target.value)} className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-xs font-mono" placeholder="Paste your Meta App Secret here" />
              <button type="button" onClick={() => copyToClipboard("App Secret", appSecret)} className="flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium border-border bg-background hover:bg-secondary"><Clipboard className="h-3.5 w-3.5" />Copy</button>
              <button type="button" onClick={regenerateSecret} className="rounded border px-2 py-0.5 text-xs hover:bg-secondary">regen</button>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Paste your real App Secret from Meta App Dashboard. This is stored encrypted in the database — no env vars needed.</p>
          </div>
        </div>
      </StepBlock>

      {/* Step 3: Save to database (NEW — replaces the old "Set env vars on Vercel" step) */}
      <StepBlock step={3} title="Save Webhook Config to Database">
        <p className="text-sm text-muted-foreground">
          Click the button below to save your Verify Token + App Secret to the database. This replaces the old method of setting <code className="rounded bg-muted px-1.5 py-0.5">WHATSAPP_VERIFY_TOKEN</code> and <code className="rounded bg-muted px-1.5 py-0.5">WHATSAPP_APP_SECRET</code> environment variables — everything is now stored in the database and managed from this page.
        </p>
        <button type="button" disabled={saving || !verifyToken.trim() || !appSecret.trim()} onClick={() => void saveConfig()} className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-5 text-sm font-semibold text-background disabled:opacity-50">
          <Save size={16} /> {saving ? "Saving…" : "Save Webhook Config"}
        </button>
        {savedMsg && <p className={`mt-2 text-sm ${savedMsg.includes("saved") || savedMsg.includes("database") ? "text-emerald-700" : "text-destructive"}`}>{savedMsg}</p>}
      </StepBlock>

      {/* Step 4: Meta Business Suite configuration */}
      <StepBlock step={4} title="Configure the webhook in Meta Business Suite">
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li><strong>1.</strong> Open <a href="https://business.facebook.com/wa/manage/phone" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Meta Business Suite → WhatsApp Manager <ExternalLink className="h-3 w-3" /></a></li>
          <li><strong>2.</strong> Navigate to <code className="rounded bg-muted px-1.5 py-0.5">WhatsApp Manager → Configuration → Webhooks</code> (or: <code className="rounded bg-muted px-1.5 py-0.5">Apps → your WhatsApp Business app → Webhooks</code>).</li>
          <li><strong>3.</strong> Click <strong>Edit</strong> next to the Webhook field.</li>
          <li><strong>4.</strong> Paste your <strong>Callback URL</strong> (step 1) into the <em>Callback URL</em> field.</li>
          <li><strong>5.</strong> Paste your <strong>Verify Token</strong> (step 2) into the <em>Verify Token</em> field.</li>
          <li><strong>6.</strong> Click <strong>Verify and Save</strong>. Meta will send a GET to your webhook — your deployment will verify the token against the database and respond with 200 + the challenge. This works automatically once step 3 is done.</li>
          <li><strong>7.</strong> After verifying, subscribe to these fields: <code className="rounded bg-muted px-1.5 py-0.5">messages</code>, <code className="rounded bg-muted px-1.5 py-0.5">message_template_status_change</code>, <code className="rounded bg-muted px-1.5 py-0.5">phone_number_quality_update</code>, <code className="rounded bg-muted px-1.5 py-0.5">account_update</code>.</li>
        </ol>
      </StepBlock>

      {/* Step 5: Connect a WhatsApp number — the connect form is rendered
          inline here (passed as children from the parent), so the user sees
          the form IN the setup guide, not in a separate section below. */}
      <StepBlock step={5} title="Connect your WhatsApp Business number">
        <p className="text-sm text-muted-foreground">
          Once the webhook is verified by Meta (step 4), fill in the form below to connect your WhatsApp Business phone. Use the <strong>same Verify Token</strong> from step 2. Inbound messages will start flowing into the messages list automatically.
        </p>
        {children}
      </StepBlock>
    </section>
  );
}

function StepBlock({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-full bg-foreground text-[11px] font-bold text-background">{step}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function CopyField({ label, value, copied, onCopy, action, help }: { label: string; value: string; copied: string; onCopy: (label: string, value: string) => void; action?: React.ReactNode; help?: string; }) {
  const isCopied = copied === label;
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-stretch gap-2">
        <input readOnly value={value} className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={() => onCopy(label, value)} className={`flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition ${isCopied ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700" : "border-border bg-background hover:bg-secondary"}`}>
          {isCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {isCopied ? "Copied" : "Copy"}
        </button>
        {action}
      </div>
      {help ? <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function generateToken(bytes: number): string {
  const arr = new Uint8Array(bytes);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
