import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_COOKIE,
  ValidationError,
  hashSessionToken,
  normalizeEmail,
  normalizeIpAddress,
  validateEmail,
  validatePasswordForCreation,
  validatePasswordForLogin,
} from "../src/lib/identity/local-auth";

describe("application-owned authentication", () => {
  it("normalizes email before identity lookup", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("rejects malformed emails", () => {
    expect(() => validateEmail("not-an-email")).toThrow(ValidationError);
    expect(() => validateEmail("a@b")).toThrow(ValidationError);
  });

  it("enforces password creation policy", () => {
    expect(() => validatePasswordForCreation("short1A")).toThrow(ValidationError);
    expect(() => validatePasswordForCreation("alllowercase123")).toThrow(ValidationError);
    expect(() => validatePasswordForCreation("ALLUPPERCASE123")).toThrow(ValidationError);
    expect(() => validatePasswordForCreation("NoNumberPassword")).toThrow(ValidationError);
    expect(() => validatePasswordForCreation("ValidPassword123")).not.toThrow();
  });

  it("allows bounded login passwords without leaking password policy details", () => {
    expect(() => validatePasswordForLogin("x")).not.toThrow();
    expect(() => validatePasswordForLogin("")).toThrow(ValidationError);
    expect(() => validatePasswordForLogin("x".repeat(129))).toThrow(ValidationError);
  });

  it("normalizes client IP metadata before database persistence", () => {
    expect(normalizeIpAddress("203.0.113.10")).toBe("203.0.113.10");
    expect(normalizeIpAddress("2001:db8::1")).toBe("2001:db8::1");
    expect(normalizeIpAddress("attacker, 203.0.113.10")).toBeNull();
  });

  it("hashes session tokens deterministically and never stores the raw token", () => {
    const raw = "example-session-token";
    const hash = hashSessionToken(raw);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(raw);
    expect(hashSessionToken(raw)).toBe(hash);
  });

  it("uses the HttpOnly session cookie name", () => {
    expect(ACCESS_TOKEN_COOKIE).toBe("aca-access-token");
  });
});
