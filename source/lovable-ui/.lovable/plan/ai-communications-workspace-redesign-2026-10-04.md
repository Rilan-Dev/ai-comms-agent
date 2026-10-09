# AI Communications Workspace Redesign

## Goal

Recreate the useful product surfaces from `Rilan-Dev/ai-comms-agent` in this workspace and redesign them as a polished, AI-native communications command center inspired by ElevenLabs’ restrained, premium product language.

## What the source currently provides

- A multi-channel communications product covering email, WhatsApp, chat, voice, schedules, agents, knowledge, activity, and audit.
- A basic application shell with sidebar and top bar.
- Early overview and inbox screens using mock data; the current UI is functional scaffolding rather than a finished product experience.
- Architecture and workflow documentation that will guide information hierarchy and terminology.

## Visual direction

- Professional monochrome foundation with warm off-white surfaces, deep ink text, precise borders, and a restrained electric accent.
- Clean grotesk typography, spacious but operationally dense layouts, and subtle waveform/activity motifs.
- ElevenLabs-inspired clarity: minimal chrome, strong type hierarchy, compact controls, crisp states, and purposeful motion—without copying its branding.
- Agent presence is persistent and contextual: the interface should show what the agent is observing, deciding, drafting, and awaiting approval for.

## Build plan

1. **Adapt the source product model**
   - Bring the relevant navigation, labels, mock communication data, and documented workflows into the current TanStack application.
   - Preserve this workspace’s supported architecture rather than importing the source Next.js runtime wholesale.

2. **Create the application shell**
   - Build a responsive left navigation, organization context, global search/command entry, notifications, and user controls.
   - Include desktop and mobile navigation behavior with accessible keyboard and focus states.

3. **Design the AI-native overview**
   - Replace generic metric cards with a live operational canvas: priority inbox, agent activity stream, approval queue, scheduled work, channel health, and concise daily briefing.
   - Make the primary agent composer support clear text and voice entry states visually.

4. **Redesign the unified inbox**
   - Use a high-scan three-pane workflow for sources, conversations, and message detail.
   - Surface AI summaries, importance, intent, suggested actions, draft status, and human-approval checkpoints without overwhelming the message content.

5. **Add focused product states**
   - Provide realistic empty, active, processing, warning, and approval-required states using source-aligned mock data.
   - Use restrained transitions for panel changes, activity updates, and voice/listening feedback, with reduced-motion support.

6. **Establish the design system**
   - Define semantic color, type, spacing, border, elevation, and state tokens.
   - Build reusable navigation, status, channel, activity, conversation, approval, and composer patterns.

7. **Polish and verify**
   - Add route-specific page metadata.
   - Verify the overview and inbox at desktop and mobile sizes, including text fit, contrast, navigation, interactive states, and error-free rendering.

## Technical notes

- The GitHub project cannot become the workspace through a direct clone operation here. Its relevant product UI and mock content will be adapted into the existing TanStack Start project.
- This phase changes frontend presentation and interactions only. It will not connect live email, WhatsApp, ElevenLabs, authentication, or persistent data unless separately requested.
- GitHub remains read-only during this work; no changes will be pushed to the source repository.
