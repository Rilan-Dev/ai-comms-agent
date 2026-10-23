"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Mic,
  Radio,
  Boxes,
  KeyRound,
  Loader2,
} from "lucide-react";
import { AIProviderSetupShared } from "./ai-provider-setup-shared";

type Tab = "chat" | "voice-chat" | "realtime" | "embedding";

const TABS: Array<{ id: Tab; label: string; icon: typeof Bot; description: string }> = [
  { id: "chat", label: "Chat & writing", icon: Bot, description: "Choose the AI service that powers agent replies, writing help and approved tools." },
  { id: "voice-chat", label: "Voice pipeline", icon: Mic, description: "Turn speech into text and text into speech. Both TTS and STT need their own configuration." },
  { id: "realtime", label: "Live voice", icon: Radio, description: "Configure low-latency voice. Supported transports vary by provider, and connection still needs runtime verification." },
  { id: "embedding", label: "Knowledge search", icon: Boxes, description: "Create semantic embeddings to help agents retrieve the right information from knowledge sources." },
];

export default function AIProviderSetupPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [tab, setTab] = useState<Tab>("chat");

  useEffect(() => {
    void fetch("/api/settings/organization", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) return;
        const body = await r.json();
        if (body.organization?.id) setOrganizationId(body.organization.id);
      })
      .catch(() => undefined);
  }, []);

  const activeTab = useMemo(() => TABS.find((t) => t.id === tab)!, [tab]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border pb-5">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Provider Setup</h1>
            <p className="text-sm text-muted-foreground">
              Set up the right AI service for each job: chat, voice, realtime conversation or knowledge search. Agents can override organization defaults.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4 text-sm">
          <p className="font-semibold">A simpler way to connect AI providers</p>
          <p className="mt-1 text-muted-foreground">Select what you want to enable below, choose a compatible provider card, then add credentials and a supported model. Saving one capability does not automatically enable the others.</p>
        </div>

        {/* Each tab represents a separate business capability, not a provider dropdown. */}
        <div className="mt-6 flex flex-wrap gap-1 rounded-xl bg-muted/40 p-1" role="group" aria-label="AI provider capability">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition " +
                  (isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
                aria-pressed={isActive}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Active tab description */}
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{activeTab.description}</p>

        {/* Tab panel */}
        <div className="mt-4">
          {!organizationId ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Resolving organization context…
            </p>
          ) : (
            <AIProviderSetupShared
              organizationId={organizationId}
              tab={tab}
            />
          )}
        </div>
      </div>
    </div>
  );
}
