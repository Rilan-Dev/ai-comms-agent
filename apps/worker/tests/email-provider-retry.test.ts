import assert from "node:assert/strict";
import test from "node:test";
import { isRetryableProviderError, withProviderRetry } from "../src/email/retry";

test("provider retry retries transient failures with bounded exponential backoff", async () => {
  let attempts = 0;
  const delays: number[] = [];
  const result = await withProviderRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("Gmail API 503: temporary outage");
    return "ok";
  }, { baseDelayMs: 10, maxDelayMs: 50, sleep: async (delay) => { delays.push(delay); } });
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("provider retry does not retry credential failures", async () => {
  let attempts = 0;
  await assert.rejects(
    () => withProviderRetry(async () => { attempts += 1; throw new Error("IMAP authentication failed"); }, { sleep: async () => {} }),
    /authentication failed/,
  );
  assert.equal(attempts, 1);
});

test("provider retry stops after the configured attempt limit", async () => {
  let attempts = 0;
  await assert.rejects(
    () => withProviderRetry(async () => { attempts += 1; throw new Error("TLS connection timeout"); }, { maxAttempts: 3, sleep: async () => {} }),
    /timeout/,
  );
  assert.equal(attempts, 3);
});

test("retry classifier treats transient provider failures as retryable", () => {
  assert.equal(isRetryableProviderError(new Error("Zoho Mail API 429: rate limit")), true);
  assert.equal(isRetryableProviderError(new Error("Gmail API 503: unavailable")), true);
  assert.equal(isRetryableProviderError(new Error("IMAP authentication failed")), false);
  assert.equal(isRetryableProviderError(new Error("invalid refresh token")), false);
});


test("provider retry exposes deterministic retry telemetry", async () => {
  const retries: Array<{ attempt: number; nextAttempt: number; delayMs: number }> = [];
  let attempts = 0;
  await withProviderRetry(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("HTTP 503 temporary outage");
      return "ok";
    },
    {
      baseDelayMs: 5,
      sleep: async () => {},
      onRetry: ({ attempt, nextAttempt, delayMs }) => {
        retries.push({ attempt, nextAttempt, delayMs });
      },
    },
  );
  assert.deepEqual(retries, [
    { attempt: 1, nextAttempt: 2, delayMs: 5 },
    { attempt: 2, nextAttempt: 3, delayMs: 10 },
  ]);
});
