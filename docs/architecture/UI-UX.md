# UI-UX.md — UI/UX Architecture (Document Only — Do Not Build in Phase 1)

Per the master operating prompt §18, Phase 1 documents the application navigation and major screens. **Do not start building this UI in Phase 1. Document it first.** The UI is implemented in Phase 2 (application foundation) and onward.

This is a Phase 1 document. Exact component libraries, color systems, and pixel-level design are produced in Phase 2.

---

## 1. Application shell

The application is a single-page app (Next.js App Router) with a persistent left sidebar (navigation) and a top bar (organization switcher, user menu, notifications). The main content area changes per route.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Top bar:  [Org ▼]   [Search...]                  [🔔] [👤 Rilan ▼]            │
├────────────┬─────────────────────────────────────────────────────────────────┤
│            │                                                                  │
│  Sidebar   │                  Main content area                               │
│            │                                                                  │
│  Overview  │                                                                  │
│  Agents ▸  │                                                                  │
│  Mail ▸    │                                                                  │
│  WhatsApp  │                                                                  │
│  Automations│                                                                 │
│  Schedules │                                                                  │
│  AI & Voice│                                                                  │
│  Knowledge │                                                                  │
│  Activity  │                                                                  │
│  Audit     │                                                                  │
│  Settings  │                                                                  │
│            │                                                                  │
└────────────┴─────────────────────────────────────────────────────────────────┘
```

Responsive: on mobile, the sidebar collapses to a hamburger menu; the top bar remains.

---

## 2. Operational navigation (top-level routes)

Per the master operating prompt §18:

```text
Overview                          /  (dashboard for the selected org)

Agents
  ├── All Agents                  /agents
  └── Create Agent               /agents/new

Mail
  ├── Accounts                   /mail/accounts
  ├── Inbox                      /mail/inbox
  ├── Threads                    /mail/threads
  └── Drafts                     /mail/drafts

WhatsApp                          /whatsapp

Automations                       /automations

Schedules                         /schedules

AI & Voice                        /ai-voice

Knowledge                         /knowledge

Activity                          /activity

Audit                             /audit

Settings                          /settings
```

### 2.1 Overview (`/`)

A dashboard for the selected organization:

- Active agents (count, list of 5 most recent)
- Connected email accounts (count, last-sync status per account)
- WhatsApp account (status, last inbound/outbound)
- Today's scheduled jobs (list with next-fire times)
- Today's activity summary (turns, tokens, cost)
- Recent audit events (last 10)
- Open alerts (DLQ depth, failed syncs, etc.)

### 2.2 Agents (`/agents`, `/agents/new`, `/agents/[id]/*`)

#### `/agents` — All Agents

Table of agents: name, status (draft/active/paused/archived), current version, connected email accounts count, WhatsApp status, last activity, actions (edit, pause, archive).

#### `/agents/new` — Create Agent

Wizard: name, description, AI config (provider, model), voice config (provider, voice), email accounts (multi-select), WhatsApp account (select), KB bindings, tools (allowed list), schedules, automations. On submit: creates agent in `draft` status.

#### `/agents/[id]/*` — Agent configuration

Per the master operating prompt §18, agent configuration has these tabs:

```text
Overview       /agents/[id]
AI             /agents/[id]/ai
Voice          /agents/[id]/voice
Email          /agents/[id]/email
WhatsApp       /agents/[id]/whatsapp
Knowledge      /agents/[id]/knowledge
Tools          /agents/[id]/tools
Automations    /agents/[id]/automations
Schedules      /agents/[id]/schedules
Security       /agents/[id]/security
Activity       /agents/[id]/activity
Versions       /agents/[id]/versions
```

- **Overview**: name, description, status, current version, current deployment, quick stats.
- **AI**: provider, model, temperature, max tokens, system prompt, feature flags. Per-agent override of org defaults.
- **Voice**: voice provider, voice ID, language, latency budget, fallback provider. Disabled if org has no voice provider configured.
- **Email**: list of connected email accounts, role per account (primary/read-only/send-only), sync status, capability summary.
- **WhatsApp**: bound WhatsApp account (one), status, recent conversations (link to `/whatsapp`).
- **Knowledge**: bound KBs, per-KB weight, last reindex.
- **Tools**: allowed tools (checkbox list, grouped by domain). Default: all safe tools allowed, all sensitive tools require approval policy.
- **Automations**: list of automation rules for this agent. Create/edit/delete.
- **Schedules**: list of scheduled jobs. Create/edit/cancel.
- **Security**: approval policies (per-action), allowed senders, blocked senders, IP allowlist (optional), rate limits.
- **Activity**: recent agent turns (chat/voice/WhatsApp), with intent, status, tool calls, audit links.
- **Versions**: version history with diff. Promote a version to current. Roll back.

### 2.3 Mail (`/mail/*`)

#### `/mail/accounts` — Email Accounts

Table of connected email accounts: provider, address, status, capabilities summary, last sync, sync errors. "Connect account" button (per provider: Gmail OAuth, IMAP/SMTP form, Zoho OAuth).

#### `/mail/inbox` — Inbox

Unified inbox across all connected accounts (or filter by account). Shows threads with subject, snippet, sender, time, importance score, action-required flag. Click → thread view.

#### `/mail/threads` — Threads

Thread list view (similar to inbox but grouped by thread). Click → thread detail with all messages, attachments, drafts, agent activity.

#### `/mail/drafts` — Drafts

All drafts across accounts. Status: human draft, agent-drafted (pending review), agent-drafted (approved, pending send), sent. Approve/reject/edit actions.

### 2.4 WhatsApp (`/whatsapp`)

If a WhatsApp account is connected: conversation list (per contact). Click → conversation view (messages in/out, agent activity, status events). If no account: onboarding wizard.

### 2.5 Automations (`/automations`)

List of automation rules across all agents (filter by agent). Create/edit/delete. Rule = trigger + action. Trigger examples: "email from X arrives", "email marked action-required", "scheduled time". Action examples: "draft reply", "send WhatsApp summary", "classify and label".

### 2.6 Schedules (`/schedules`)

List of scheduled jobs across all agents (filter by agent). Create/edit/cancel. Schedule = cron + intent + params. Example: "Every day at 08:00, summarize last 24h of important/action-required emails and send the summary to WhatsApp."

### 2.7 AI & Voice (`/ai-voice`)

Organization-level AI and voice configuration:

- AI providers (OpenAI, Gemini, Sarvam, TEI): API key (encrypted), default model, feature flags.
- Voice providers (OpenAI Realtime, Gemini Live, Sarvam, ElevenLabs): API key (encrypted), default voice, latency budget.
- Usage dashboard: tokens per day, cost per day, per-agent breakdown.
- Voice telemetry dashboard: TTFA histogram, latency trends.

### 2.8 Knowledge (`/knowledge`)

Knowledge bases (Clara KB contracts). List, create, delete. Per-KB: documents, embeddings, reindex, search test.

### 2.9 Activity (`/activity`)

Real-time and historical activity feed: agent turns, tool calls, scheduled job runs, automation runs. Filter by agent, channel, time range. Click → detail view with full audit trail.

### 2.10 Audit (`/audit`)

Admin-only. Searchable audit log: filter by event type, actor, target, time range. Export to JSON/CSV.

### 2.11 Settings (`/settings`)

Organization settings:

- General: name, slug, default timezone
- Members: list, invite, remove, change role
- API keys: list, create, revoke
- Security: MFA enforcement, IP allowlist, session policy
- Billing: N/A (not a SaaS billing product — per `RULES.md §5`)
- Integrations: connected providers (Gmail clients, Zoho clients, Meta Business Account)
- Danger zone: delete organization (requires owner role + MFA)

---

## 3. Chat experience

Chat is accessible from any page via a floating "Ask agent" button (bottom-right). Opens a chat panel:

```text
┌─────────────────────────────────┐
│  Agent: [Sales Agent ▼]   [×]   │
├─────────────────────────────────┤
│                                 │
│  (conversation messages)        │
│                                 │
│  ┌───────────────────────────┐  │
│  │ User: summarize today's   │  │
│  │ important emails          │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Agent: (streaming...)     │  │
│  │ Today you have 3          │  │
│  │ important emails:         │  │
│  │ 1. From X (action req'd)  │  │
│  │ 2. From Y (deadline)      │  │
│  │ 3. From Z (FYI)           │  │
│  │                            │  │
│  │ [Open in Mail] [Draft     │  │
│  │  replies]                  │  │
│  └───────────────────────────┘  │
│                                 │
├─────────────────────────────────┤
│  [💬 Ask anything...]  [🎤] [➤] │
└─────────────────────────────────┘
```

- Agent switcher (top): select which agent to chat with.
- Streaming responses (SSE).
- Inline tool-call cards (e.g., "Reading 47 emails..." with expand for details).
- Sensitive-action approval prompts inline (e.g., "Send this reply to X?" with Approve/Reject buttons).
- Voice mode (🎤 button): opens a voice overlay with microphone waveform, transcript, and response text.

---

## 4. Voice experience

Voice mode is an overlay (not a separate page):

```text
┌──────────────────────────────────────────────────────┐
│                                                       │
│              ╭────────────────────╮                   │
│              │   ◉ Listening...    │                   │
│              ╰────────────────────╯                   │
│                                                       │
│   You: "What's important in my inbox today?"          │
│   Agent: "You have 3 important emails. The first..."  │
│                                                       │
│   [⏸ Pause]  [✖ End]                                  │
└──────────────────────────────────────────────────────┘
```

- Connection state shown (Connecting / Connected / Reconnecting / Disconnected).
- Live transcript (user + agent).
- Pause/end controls.
- Latency indicator (TTFA for last turn).
- On disconnect: auto-reconnect per Clara's `reconnect-policy.ts`.

---

## 5. Approval experience

When the agent proposes a sensitive action, the chat shows an inline approval card:

```text
┌──────────────────────────────────────────────────┐
│  ⚠ Approval required                              │
│                                                   │
│  Agent wants to send an email:                    │
│   To: alice@example.com                           │
│   Subject: Re: Project update                     │
│   Body: (preview, first 200 chars)...             │
│                                                   │
│  [Approve]  [Reject]  [Edit draft]                │
└──────────────────────────────────────────────────┘
```

- Approve: enqueues `email.send`, audit, status updates to "sending" → "sent".
- Reject: audit, status updates to "rejected", agent is informed.
- Edit draft: opens draft editor; on save, re-asks for approval.

For scheduled jobs that produce actions, approvals queue in `/mail/drafts` and surface in daily summary emails (optional, per-org).

---

## 6. Mobile

The UI is responsive:

- Sidebar collapses to a hamburger menu.
- Tables become card lists.
- Chat panel becomes full-screen on mobile.
- Voice overlay is full-screen.
- Approvals are full-screen cards.

Mobile is a first-class target (users will check WhatsApp-style notifications on mobile). Phase 2 produces the responsive layout; Phase 18 verifies mobile end-to-end.

---

## 7. Accessibility

- WCAG 2.1 AA target.
- Keyboard navigation for all controls.
- Screen-reader friendly (semantic HTML, ARIA labels).
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text.
- Reduced-motion support (CSS `prefers-reduced-motion`).

Accessibility is verified in Phase 18.

---

## 8. Theming

- Light and dark modes (user preference, persisted).
- Organization branding: logo, primary color (optional, per-org).
- Default theme: neutral, professional (slate/blue palette).

Exact theme tokens (colors, spacing, typography) are produced in Phase 2.

---

## 9. Internationalization

- English first. Architecture supports i18n (Next.js App Router i18n).
- Phase 1 scope: English only. Future phases may add Arabic, Hindi, etc. based on user demand.

---

## 10. What is explicitly NOT in Phase 1 UI scope

- No component library selection (shadcn/ui is the leading candidate — decided in Phase 2).
- No pixel-level design.
- No Figma files.
- No HTML/CSS/JSX.
- No responsive breakpoint tuning.

Phase 1 produces this document. Phase 2 (Application foundation) produces the layout shell, sidebar, top bar, and routing. Phases 3-19 produce individual screens.
