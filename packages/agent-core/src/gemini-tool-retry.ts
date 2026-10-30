/**
 * Only retry a Gemini tool decision when the upstream HTTP response declares
 * a transient failure. Never retry streamed partial results, malformed model
 * decisions or any host-side email/WhatsApp tool execution.
 *
 * The caller's completion deadline covers every attempt and all backoff.
 */
const TRANSIENT_HTTP = new Set([408, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 700;
const MAX_DELAY_MS = 6_000;

function abortFailure(): Error {
  const error = new Error("Gemini tool request was canceled.");
  error.name = "AbortError";
  return error;
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(MAX_DELAY_MS, Math.ceil(seconds * 1000));
  const when = Date.parse(value);
  return Number.isFinite(when) ? Math.min(MAX_DELAY_MS, Math.max(0, when - Date.now())) : null;
}

export async function waitForGeminiRetry(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) throw abortFailure();
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(abortFailure()); };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, ms);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
}

export async function fetchGeminiToolWithRetry(
  perform: () => Promise<Response>,
  signal: AbortSignal,
  wait: (ms: number, signal: AbortSignal) => Promise<void> = waitForGeminiRetry,
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal.aborted) throw abortFailure();
    // No retry on transport uncertainty or a partially received successful
    // stream. A provider 2xx reply is parsed exactly once by the caller.
    const response = await perform();
    if (response.ok) return response;
    const retryable = TRANSIENT_HTTP.has(response.status);
    const delay = retryAfterMs(response.headers.get("retry-after"))
      ?? Math.min(MAX_DELAY_MS, BASE_DELAY_MS * (2 ** (attempt - 1)));
    const status = response.status;
    const body = await response.text().catch(() => "");
    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`Gemini tool request failed (${status}): ${body.slice(0, 300)}`);
    }
    console.warn("[gemini] transient tool provider response; retrying", {
      status, attempt, maxAttempts: MAX_ATTEMPTS, delayMs: delay,
    });
    await wait(delay, signal);
  }
  throw new Error("Gemini tool retries exhausted.");
}
