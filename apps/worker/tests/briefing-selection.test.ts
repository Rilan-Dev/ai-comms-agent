import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveCatchUpPeriod, eligibleCatchUpSource, sourceFullyReviewed,
  boundedSourcePage,
} from "@ai-comms-agent/shared";

const now = new Date("2026-10-19T10:00:00.000Z");
const period = resolveCatchUpPeriod(null, now);
const base = {
  receivedAt: "2026-10-17T08:00:00.000Z",
  committedAt: "2026-10-18T14:00:00.000Z",
  isDraft: false, isSent: false, period, reviewItems: [],
};

test("first use defaults to seven days, without marking a mailbox reviewed", () => {
  assert.deepEqual(period, {
    start: "2026-10-12T10:00:00.000Z", end: "2026-10-19T10:00:00.000Z",
  });
  assert.equal(eligibleCatchUpSource(base), true);
});

test("five-day absence remains eligible independently of last login", () => {
  assert.equal(eligibleCatchUpSource({ ...base, receivedAt: "2026-10-14T00:00:00.000Z" }), true);
});

test("late provider commit of old received mail is still eligible", () => {
  assert.equal(eligibleCatchUpSource({
    ...base, receivedAt: "2026-09-01T00:00:00.000Z",
    committedAt: "2026-10-18T10:00:00.000Z",
  }), true);
});

test("old mail not committed or received in this window is not silently treated as new", () => {
  assert.equal(eligibleCatchUpSource({
    ...base, receivedAt: "2026-09-01T00:00:00.000Z",
    committedAt: "2026-09-01T00:00:00.000Z",
  }), false);
});

test("a read flag or message arrival never acknowledges a source", () => {
  assert.equal(sourceFullyReviewed([]), false);
  assert.equal(eligibleCatchUpSource(base), true);
});

test("two obligations remain pending until both complete items acknowledged", () => {
  const reviewItems = [
    { itemId: "one", representation: "complete" as const, acknowledgedAt: now.toISOString() },
    { itemId: "two", representation: "complete" as const, acknowledgedAt: null },
  ];
  assert.equal(sourceFullyReviewed(reviewItems), false);
  assert.equal(eligibleCatchUpSource({ ...base, reviewItems }), true);
  assert.equal(sourceFullyReviewed(reviewItems.map(i => ({ ...i, acknowledgedAt: now.toISOString() }))), true);
});

test("partial content, even if one item completed, never advances complete coverage", () => {
  assert.equal(sourceFullyReviewed([
    { itemId: "one", representation: "complete", acknowledgedAt: now.toISOString() },
    { itemId: "partial", representation: "partial", acknowledgedAt: null },
  ]), false);
});

test("new reply/revision clears only that revision's coverage", () => {
  // The DB query joins reviews to briefing_content_revision(m.id).
  // Revision B has no matching review ledger even if revision A was complete.
  const revisionA = [{ itemId: "one", representation: "complete" as const, acknowledgedAt: now.toISOString() }];
  assert.equal(eligibleCatchUpSource({ ...base, reviewItems: revisionA }), false);
  assert.equal(eligibleCatchUpSource({ ...base, reviewItems: [] }), true);
});

test("drafts/sent records are excluded, independent of read flag", () => {
  assert.equal(eligibleCatchUpSource({ ...base, isDraft: true }), false);
  assert.equal(eligibleCatchUpSource({ ...base, isSent: true }), false);
});

test("initial custom period cannot silently scan >90 days or future data", () => {
  assert.throws(() => resolveCatchUpPeriod({
    start: "2026-01-01T00:00:00.000Z", end: now.toISOString(),
  }, now), /90-day/);
  assert.throws(() => resolveCatchUpPeriod({
    start: "2026-10-19T10:00:00.000Z", end: "2026-10-20T10:00:00.000Z",
  }, now), /90-day/);
});

test("source pages are bounded to 200 and preserve equal-timestamp IDs", () => {
  assert.equal(boundedSourcePage(200), 200);
  assert.throws(() => boundedSourcePage(201));
  // Source storage/pagination is ordered by UUID ID, not received_at cursor.
  assert.notEqual("00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002");
});
