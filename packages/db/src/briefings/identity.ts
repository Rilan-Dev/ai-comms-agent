import { createHash } from 'node:crypto';

type ItemAnchor = { sourceIds: string[]; suggestedAction: string; evidence: { sourceId: string; contentRevision: string; start: number; end: number; supports: string }[] };
export function stableBriefingItemId(item: ItemAnchor, sources: { messageId: string; contentRevision: string }[]): string {
  const revisions = new Map(sources.map(s => [s.messageId, s.contentRevision]));
  const identities = [...new Set(item.sourceIds)].sort().map(id => [id, revisions.get(id)]);
  const anchors = item.evidence.map(e => [e.sourceId, e.contentRevision, e.start, e.end, e.supports]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash('sha256').update(JSON.stringify([identities, item.suggestedAction, anchors])).digest('hex');
}
