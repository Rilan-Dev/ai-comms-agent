export type TrustedBriefingPrincipal = { organizationId: string; userId: string; agentId: string };
export type BriefingPeriod = { start: string; end: string };
export type BriefingRequest = { mailboxIds: string[]; language: string; requestKey: string } & (
  | { mode: 'catch_up'; period: BriefingPeriod | null }
  | { mode: 'scheduled'; period: BriefingPeriod; routine: {
      id: string; revision: number; occurrenceId: string; coverageKey: string;
      window: 'since_previous_occurrence' | 'previous_24_hours' | 'previous_local_day';
    } }
);
export type EffectiveBriefingScope = TrustedBriefingPrincipal & { mailboxIds: string[]; scopeVersion: string };
export type BriefingSource = { messageId: string; mailboxId: string; threadId: string; contentRevision: string };
export type BriefingManifest = {
  id: string; scope: EffectiveBriefingScope; mode: BriefingRequest['mode'];
  period: BriefingRequest['period']; sourceCount: number; status: 'pending' | 'partial' | 'ready' | 'failed' | 'invalidated';
};
export type BriefingItem = {
  id: string; sourceIds: string[]; priority: 'high' | 'medium' | 'low';
  title: string; summary: string; reason: string; deadline: string | null;
  confidence: 'supported' | 'uncertain'; suggestedAction: 'reply' | 'review' | 'follow_up' | 'none';
  evidence: { sourceId: string; contentRevision: string; start: number; end: number;
    quote: string; supports: 'deadline' | 'amount' | 'priority_reason' | 'summary' }[];
  representation: 'complete' | 'partial'; snoozedUntil: string | null;
};
export type BriefingRead = { manifest: BriefingManifest; items: BriefingItem[]; reviewedItemIds?: string[] };
export type BriefingListOptions = { limit?: number; before?: { createdAt: string; id: string } };
export type BriefingList = { briefings: BriefingRead[]; nextCursor: { createdAt: string; id: string } | null };
