import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@ai-comms-agent/db", () => ({
  query: queryMock,
}));

import { resolveAccountIdentifier } from "../../../packages/email-agent-runtime/src/account-identifier";

const ORG = "11111111-1111-1111-1111-111111111111";
const AGENT = "22222222-2222-2222-2222-222222222222";
const ACCOUNT = "33333333-3333-3333-3333-333333333333";

describe("resolveAccountIdentifier", () => {
  afterEach(() => vi.clearAllMocks());

  it("passes a valid UUID through without a database lookup", async () => {
    const result = await resolveAccountIdentifier(ORG, AGENT, ACCOUNT);
    expect(result).toBe(ACCOUNT);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("normalizes an uppercase UUID to lowercase", async () => {
    const result = await resolveAccountIdentifier(ORG, AGENT, ACCOUNT.toUpperCase());
    expect(result).toBe(ACCOUNT);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("resolves an email address through the agent binding scope", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: ACCOUNT }] });
    const result = await resolveAccountIdentifier(ORG, AGENT, "mohammedrilan20022002@gmail.com");
    expect(result).toBe(ACCOUNT);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0]!;
    expect(String(sql)).toContain("lower(a.email_address) = lower($3)");
    expect(params).toEqual([AGENT, ORG, "mohammedrilan20022002@gmail.com"]);
  });

  it("resolves an email address case-insensitively", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ id: ACCOUNT }] });
    const result = await resolveAccountIdentifier(ORG, AGENT, "  MohammedRilan20022002@Gmail.com ");
    expect(result).toBe(ACCOUNT);
    const [, params] = queryMock.mock.calls[0]!;
    expect(params[2]).toBe("MohammedRilan20022002@Gmail.com");
  });

  it("returns null for an unbound email address instead of throwing", async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await resolveAccountIdentifier(ORG, AGENT, "stranger@example.com");
    expect(result).toBeNull();
  });

  it("returns null for arbitrary non-UUID text instead of throwing", async () => {
    // This is the regression guard for the production bug: a non-UUID
    // account_id previously reached a uuid-typed SQL comparison and threw
    // "invalid input syntax for type uuid", which the tool executor's
    // generic catch surfaced as the cryptic authorization_unavailable
    // error. The resolver must return null so callers can deny cleanly.
    queryMock.mockResolvedValueOnce({ rows: [] });
    const result = await resolveAccountIdentifier(ORG, AGENT, "some-random-id");
    expect(result).toBeNull();
  });

  it("returns null for an empty identifier", async () => {
    const result = await resolveAccountIdentifier(ORG, AGENT, "   ");
    expect(result).toBeNull();
    expect(queryMock).not.toHaveBeenCalled();
  });
});
