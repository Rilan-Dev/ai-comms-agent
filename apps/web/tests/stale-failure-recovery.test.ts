import { describe, expect, it } from "vitest";
import {
  buildStaleFailureRecoveryGuidance,
  isStaleFailureAnswer,
  type StaleFailureHistoryMessage,
} from "@/lib/chat/stale-failure-recovery";

const failureAnswer = (mailbox: string) =>
  `I'm sorry, but the read-only tool results for ${mailbox} show an authorization failure. I cannot access your inbox, so I'm unable to summarize your unread emails. Please re-authorize or reconnect the account.`;
const goodAnswer = "Here is your unread email summary: 12 unread, with 3 business mails highlighted.";
const userTurn = (text: string): StaleFailureHistoryMessage => ({ role: "user", content: text });

describe("isStaleFailureAnswer", () => {
  it("marks authorization-failure answers", () => {
    expect(isStaleFailureAnswer(failureAnswer("a@gmail.com"))).toBe(true);
    expect(isStaleFailureAnswer("The account is not authorized; reconnect it.")).toBe(true);
    expect(isStaleFailureAnswer("authorization_unavailable was returned")).toBe(true);
  });

  it("does not mark successful answers or user messages", () => {
    expect(isStaleFailureAnswer(goodAnswer)).toBe(false);
    expect(isStaleFailureAnswer("I couldn't find any emails about that topic.")).toBe(false);
  });
});

describe("buildStaleFailureRecoveryGuidance", () => {
  const poisonedHistory: StaleFailureHistoryMessage[] = [
    userTurn("summery my emails"),
    { role: "assistant", content: failureAnswer("a@gmail.com") },
    userTurn("summery my emails again"),
    { role: "assistant", content: failureAnswer("a@gmail.com") },
    userTurn("summery my emails please"),
    { role: "assistant", content: failureAnswer("a@gmail.com") },
  ];

  it("engages for a mail question after repeated failures", () => {
    const guidance = buildStaleFailureRecoveryGuidance(poisonedHistory, "Summarize my unread emails");
    expect(guidance).toBeTruthy();
    expect(guidance).toContain("Stale-failure recovery notice");
    expect(guidance).toContain("email.accounts.list");
    expect(guidance).toContain("THIS turn");
  });

  it("engages for the historical repro message", () => {
    const guidance = buildStaleFailureRecoveryGuidance(
      poisonedHistory,
      "summery my mohammedrilan20022002@gmail.com emails all unreaded mails and high light business mails as well",
    );
    expect(guidance).toBeTruthy();
  });

  it("does not engage for non-mail questions even with poisoned history", () => {
    expect(buildStaleFailureRecoveryGuidance(poisonedHistory, "What is the weather like?")).toBeNull();
  });

  it("does not engage when history is healthy", () => {
    const healthy: StaleFailureHistoryMessage[] = [
      userTurn("summarize"),
      { role: "assistant", content: goodAnswer },
      userTurn("again"),
      { role: "assistant", content: goodAnswer },
    ];
    expect(buildStaleFailureRecoveryGuidance(healthy, "Summarize my unread emails")).toBeNull();
  });

  it("requires at least two recent failure answers (one honest miss is not poisoning)", () => {
    const single: StaleFailureHistoryMessage[] = [
      userTurn("summarize"),
      { role: "assistant", content: failureAnswer("a@gmail.com") },
      userTurn("again"),
      { role: "assistant", content: goodAnswer },
    ];
    expect(buildStaleFailureRecoveryGuidance(single, "Summarize my unread emails")).toBeNull();
  });

  it("only considers the most recent assistant window", () => {
    const oldPoisonThenFixed: StaleFailureHistoryMessage[] = [
      userTurn("a"),
      { role: "assistant", content: failureAnswer("a@gmail.com") },
      userTurn("b"),
      { role: "assistant", content: failureAnswer("a@gmail.com") },
      userTurn("c"),
      { role: "assistant", content: goodAnswer },
      userTurn("d"),
      { role: "assistant", content: goodAnswer },
      userTurn("e"),
      { role: "assistant", content: goodAnswer },
      userTurn("f"),
      { role: "assistant", content: goodAnswer },
      userTurn("g"),
      { role: "assistant", content: goodAnswer },
      userTurn("h"),
      { role: "assistant", content: goodAnswer },
    ];
    expect(buildStaleFailureRecoveryGuidance(oldPoisonThenFixed, "Summarize my unread emails")).toBeNull();
  });

  it("handles empty history and empty message", () => {
    expect(buildStaleFailureRecoveryGuidance([], "Summarize my unread emails")).toBeNull();
    expect(buildStaleFailureRecoveryGuidance(poisonedHistory, "")).toBeNull();
    expect(buildStaleFailureRecoveryGuidance(poisonedHistory, "   ")).toBeNull();
  });
});
