"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Mic,
  Radio,
  Boxes,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { AIProviderSetupShared } from "./ai-provider-setup-shared";

type Tab = "chat" | "voice-chat" | "realtime" | "embedding";

const TABS: Array<{ id: Tab; label: string; icon: typeof Bot; description: string }> = [
  { id: "chat",         label: "Chat Models",           icon: Bot,   description: "Text chat completions. Used by /api/chat/stream and worker agent execution." },
  { id: "voice-chat",   label: "Voice Chat (TTS / STT)", icon: Mic,   description: "Text-to-speech + speech-to-text pipeline. ElevenLabs and Sarvam Bulbul / Saaras." },
  { id: "realtime",     label: "Realtime Voice AI Agent", icon: Radio, description: "Realtime voice: OpenAI Realtime or Gemini Live; Sarvam Saaras and ElevenLabs Scribe streaming STT + host AI/TTS relays. ElevenLabs Conversational AI agents require a separate integration." },
  { id: "embedding",     label: "Embedding Models",       icon: Boxes, description: "Vector embeddings for RAG / knowledge retrieval. OpenAI text-embedding-3-* / Gemini embedding-*." },
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
              Configure credentials and models for chat, voice, realtime, and embeddings. Each agent can override these org-level defaults.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-1 rounded-xl bg-muted/40 p-1">
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
