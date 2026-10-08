export interface RetryPolicy {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (context: { attempt: number; nextAttempt: number; delayMs: number; error: unknown }) => void | Promise<void>;
}

export function isRetryableProviderError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (/authentication failed|invalid.*(credential|token)|unauthorized|forbidden|revoked|no refresh token|requires .*token|requires password/.test(normalized)) return false;
  if (/\b(400|401|403)\b/.test(normalized)) return false;
  return /\b(408|429|500|502|503|504)\b|timeout|timed out|econn|enotfound|network|temporar|rate limit|reset by peer|tls connection/i.test(message);
}

export async function withProviderRetry<T>(operation: () => Promise<T>, policy: RetryPolicy = {}): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(policy.maxAttempts ?? 3, 5));
  const baseDelayMs = Math.max(0, policy.baseDelayMs ?? 250);
  const maxDelayMs = Math.max(baseDelayMs, policy.maxDelayMs ?? 2_000);
  const shouldRetry = policy.shouldRetry ?? ((error) => isRetryableProviderError(error));
  const sleep = policy.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  const onRetry = policy.onRetry ?? (() => undefined);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) throw error;
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await onRetry({ attempt, nextAttempt: attempt + 1, delayMs: delay, error });
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
