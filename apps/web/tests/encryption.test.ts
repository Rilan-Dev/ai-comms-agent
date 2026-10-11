import { describe, expect, it } from "vitest";
import {
  decryptCredential,
  encryptCredential,
  parseCredentialsMasterKey,
} from "@ai-comms-agent/db";

describe("credential envelope encryption", () => {
  const kek = Buffer.alloc(32, 7);

  it("round-trips plaintext through AES-256-GCM envelope encryption", () => {
    const encrypted = encryptCredential("provider-secret", kek);
    expect(encrypted.toString("utf8")).not.toContain("provider-secret");
    expect(decryptCredential(encrypted, kek).toString("utf8")).toBe("provider-secret");
  });

  it("uses a fresh data key and ciphertext for each encryption", () => {
    const first = encryptCredential("same-secret", kek);
    const second = encryptCredential("same-secret", kek);
    expect(first.equals(second)).toBe(false);
  });

  it("rejects a wrong key", () => {
    const encrypted = encryptCredential("provider-secret", kek);
    expect(() => decryptCredential(encrypted, Buffer.alloc(32, 8))).toThrow();
  });

  it("rejects malformed master keys", () => {
    expect(() => parseCredentialsMasterKey("not-a-key")).toThrow(/32 bytes/);
  });

  it("accepts a 32-byte base64 or hex master key", () => {
    const bytes = Buffer.alloc(32, 11);
    expect(parseCredentialsMasterKey(bytes.toString("base64")).equals(bytes)).toBe(true);
    expect(parseCredentialsMasterKey(bytes.toString("hex")).equals(bytes)).toBe(true);
  });
});
