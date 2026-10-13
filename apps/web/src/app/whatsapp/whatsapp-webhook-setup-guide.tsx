"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clipboard, ExternalLink, KeyRound, Loader2, AlertCircle, Webhook } from "lucide-react";

/**
 * Self-contained WhatsApp webhook setup guide.
 * - Detects the current deployment URL (works on Vercel aliases AND custom
 *   domains like aca.ostechnologies.in — the user's production domain).
 * - Generates random verify_token + app_secret values via Web Crypto.
 * - Copy-to-clipboard buttons for every value the user needs to paste into
 *   Meta Business Suite OR into Vercel env vars.
 * - Live verify check: pings the webhook with hub.mode=subscribe to see
 *   whether WHATSAPP_VERIFY_TOKEN is configured on Vercel.
 */
export function WhatsAppWebhookSetupGuide() {
  const [origin, setOrigin] = useState<string>("");
  const [verifyToken, setVerifyToken] = useState<string>("");
  const [appSecret, setAppSecret] = useState<string>("");
  const [copied, setCopied] = useState<string>("");
  const [verifyStatus, setVerifyStatus] = useState<"unknown" | "checking" | "ok" | "missing_token" | "fail">("unknown");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      // Pre-seed with random values once on mount so the user has something
      // to copy immediately.
      if (!verifyToken) setVerifyToken(generateToken(32));
      if (!appSecret) setAppSecret(generateToken(24));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const webhookUrl = useMemo(() => `${origin}/api/whatsapp/webhook`, [origin]);

  async function copyToClipboard(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      // Fallback: select-and-prompt
      window.prompt(`Copy this value (${label}):`, value);
    }
  }

  async function checkWebhookConfigured() {
    setVerifyStatus("checking");
    try {
      // Hit the webhook endpoint with a subscribe probe. The route handler
      // returns 200 + the challenge if WHATSAPP_VERIFY_TOKEN matches the
      // provided verify_token. We pass a token that we KNOW won't match —
      // the response code lets us distinguish:
      //   - 403 / 422 → endpoint exists, but verify_token mismatched →
      //     env var IS set but to a DIFFERENT value
      //   - 200 → endpoint exists AND verify_token matched the env var →
      //     but we passed a probe token, so this shouldn't happen unless
      //     the env var is unset AND the route falls back
      //   - 404 → endpoint doesn't exist (deployment issue)
      const probeToken = "PROBE_" + Math.random().toString(36).slice(2);
      const url = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(probeToken)}&hub.challenge=test`;
      const res = await fetch(url, { method: "GET" });
      if (res.status === 404) {
        setVerifyStatus("fail");
        return;
      }
      if (res.status === 403 || res.status === 422 || res.status === 401) {
        // verify_token mismatched → env var IS configured on Vercel
        setVerifyStatus("ok");
        return;
      }
      if (res.status === 200) {
        // 200 means the env var was either unset (and the route fell back)
        // or it matched our probe token (impossible). Mark as missing.
        setVerifyStatus("missing_token");
        return;
      }
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
        {verifyStatus === "checking" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : verifyStatus === "ok" ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : verifyStatus === "missing_token" || verifyStatus === "fail" ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        <span className="flex-1">
          {verifyStatus === "checking" && "Checking webhook configuration…"}
          {verifyStatus === "ok" && "WHATSAPP_VERIFY_TOKEN env var is set on the deployment."}
          {verifyStatus === "missing_token" && "WHATSAPP_VERIFY_TOKEN env var is NOT set on the deployment. Run step 4 below."}
          {verifyStatus === "fail" && "Could not reach the webhook endpoint. Check the deployment URL."}
          {verifyStatus === "unknown" && "Click 'Check webhook status' to verify the env vars are set."}
        </span>
        <button
          type="button"
          onClick={() => void checkWebhookConfigured()}
          className="rounded-md border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-secondary"
        >
          Check webhook status
        </button>
      </div>

      {/* Step 1: Webhook URL */}
      <StepBlock step={1} title="Copy your webhook URL">
        <p className="text-sm text-muted-foreground">
          This URL receives POST requests from Meta when a customer messages your WhatsApp Business number. It's already live on your deployment — no setup needed on this side.
        </p>
        <CopyField label="Webhook URL" value={webhookUrl} copied={copied} onCopy={copyToClipboard} />
      </StepBlock>

      {/* Step 2: Generate verify token + app secret */}
      <StepBlock step={2} title="Generate your Verify Token and App Secret">
        <p className="text-sm text-muted-foreground">
          Generate two random strings. The <strong>Verify Token</strong> is a shared secret you'll paste into BOTH Meta Business Suite AND the WHATSAPP_VERIFY_TOKEN env var. The <strong>App Secret</strong> comes from your Meta App's dashboard (don't generate it here — see step 3).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyField
            label="Verify Token"
            value={verifyToken}
            copied={copied}
            onCopy={copyToClipboard}
            action={<button type="button" onClick={regenerateToken} className="ml-2 rounded border px-2 py-0.5 text-xs hover:bg-secondary">regenerate</button>}
          />
          <CopyField
            label="App Secret (placeholder)"
            value={appSecret}
            copied={copied}
            onCopy={copyToClipboard}
            action={<button type="button" onClick={regenerateSecret} className="ml-2 rounded border px-2 py-0.5 text-xs hover:bg-secondary">regenerate</button>}
            help="Use the App Secret from Meta Business Suite (step 3) — this placeholder is just for completeness."
          />
        </div>
      </StepBlock>

      {/* Step 3: Meta Business Suite navigation */}
      <StepBlock step={3} title="Configure the webhook in Meta Business Suite">
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li>
            <strong>1.</strong> Open{" "}
            <a href="https://business.facebook.com/wa/manage/phone" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Meta Business Suite → WhatsApp Manager <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li><strong>2.</strong> On the left sidebar: <code className="rounded bg-muted px-1.5 py-0.5">WhatsApp Manager → Configuration → Webhooks</code> (or: <code className="rounded bg-muted px-1.5 py-0.5">Apps → your WhatsApp Business app → Webhooks</code>).</li>
          <li><strong>3.</strong> Click <strong>Edit</strong> next to the Webhook field.</li>
          <li><strong>4.</strong> Paste your <strong>Callback URL</strong> (step 1) into the <em>Callback URL</em> field.</li>
          <li><strong>5.</strong> Paste your <strong>Verify Token</strong> (step 2) into the <em>Verify Token</em> field.</li>
          <li><strong>6.</strong> Click <strong>Verify and Save</strong>. Meta will send a GET to your webhook with <code>hub.mode=subscribe&hub.verify_token=…</code> — your deployment must respond with 200 + the <code>hub.challenge</code> value. This works automatically once step 4 below is done.</li>
          <li><strong>7.</strong> After verifying, click <strong>Manage</strong> next to the Webhook field and subscribe to these fields: <code className="rounded bg-muted px-1.5 py-0.5">messages</code>, <code className="rounded bg-muted px-1.5 py-0.5">message_template_status_change</code>, <code className="rounded bg-muted px-1.5 py-0.5">phone_number_quality_update</code>, <code className="rounded bg-muted px-1.5 py-0.5">account_update</code>. (Add <code>message_deliveries</code> + <code>message_reads</code> if you want delivery/read receipts.)</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          💡 Also retrieve your <strong>App Secret</strong> from <code className="rounded bg-muted px-1.5 py-0.5">App settings → Basic → App Secret</code> in the Meta App Dashboard — you'll need it for step 4.
        </p>
      </StepBlock>

      {/* Step 4: Vercel env vars */}
      <StepBlock step={4} title="Set WHATSAPP_VERIFY_TOKEN + WHATSAPP_APP_SECRET on Vercel">
        <p className="text-sm text-muted-foreground">
          Meta signs every webhook POST with an HMAC-SHA256 signature using your App Secret. Your deployment verifies that signature to reject spoofed requests. Set both env vars on Vercel:
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground">
          <li><strong>1.</strong> Open{" "}
            <a href="https://vercel.com/ai-comms-agent/settings/environment-variables" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              Vercel → Project Settings → Environment Variables <ExternalLink className="h-3 w-3" />
            </a>
          </li>
          <li><strong>2.</strong> Add two new variables:</li>
        </ol>
        <div className="grid gap-3 sm:grid-cols-2">
          <CopyField label="Key 1" value="WHATSAPP_VERIFY_TOKEN" copied={copied} onCopy={copyToClipboard} help="Set Value to the Verify Token from step 2. Environment = Production + Preview." />
          <CopyField label="Key 2" value="WHATSAPP_APP_SECRET" copied={copied} onCopy={copyToClipboard} help="Set Value to the App Secret from Meta App Dashboard. Environment = Production + Preview." />
        </div>
        <p className="text-xs text-muted-foreground">
          💡 After saving both env vars, Vercel will auto-redeploy. Wait ~1 min, then click "Check webhook status" above — it should turn green.
        </p>
      </StepBlock>

      {/* Step 5: Connect a WhatsApp number */}
      <StepBlock step={5} title="Connect a WhatsApp Business number">
        <p className="text-sm text-muted-foreground">
          Once the webhook is verified by Meta (step 3) and env vars are set (step 4), connect a WhatsApp Business number to your account above. Inbound messages will start flowing into the messages list automatically.
        </p>
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

function CopyField({
  label,
  value,
  copied,
  onCopy,
  action,
  help,
}: {
  label: string;
  value: string;
  copied: string;
  onCopy: (label: string, value: string) => void;
  action?: React.ReactNode;
  help?: string;
}) {
  const isCopied = copied === label;
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="mt-1 flex items-stretch gap-2">
        <input
          readOnly
          value={value}
          className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={() => onCopy(label, value)}
          className={`flex items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition ${
            isCopied ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-700" : "border-border bg-background hover:bg-secondary"
          }`}
        >
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
  // Base64url — safe for URLs and env vars
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
