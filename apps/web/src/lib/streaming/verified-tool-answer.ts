/**
 * Deliver genuine provider tokens only when they match the previously
 * authorized, completed tool-loop answer byte-for-byte.
 *
 * A model can hallucinate an action or reinterpret an approval even when
 * instructed to quote. Never expose those deviations. If the provider fails,
 * drifts, or stops early, deliver the unchanged canonical remainder in one
 * chunk and report a truthful fallback mode (not fake streaming).
 */
export type VerifiedAnswerResult = {
  completed: boolean;
  mode: "verified-provider-tokens" | "canonical-fallback" | "aborted";
};

export async function emitVerifiedToolAnswer(
  canonical: string,
  generate: () => Promise<AsyncIterable<string>>,
  emitDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<VerifiedAnswerResult> {
  if (signal?.aborted) return { completed: false, mode: "aborted" };
  let matched = 0;
  let providerComplete = false;
  try {
    const stream = await generate();
    for await (const chunk of stream) {
      if (signal?.aborted) return { completed: false, mode: "aborted" };
      if (!chunk) continue;
      if (!canonical.startsWith(chunk, matched)) break;
      matched += chunk.length;
      emitDelta(chunk);
    }
    providerComplete = matched === canonical.length;
  } catch {
    // No generated words may leak. The canonical answer was already validated
    // by the host tool loop and is the only allowed user-visible fallback.
  }
  if (signal?.aborted) return { completed: false, mode: "aborted" };
  if (matched < canonical.length) emitDelta(canonical.slice(matched));
  return {
    completed: true,
    mode: providerComplete ? "verified-provider-tokens" : "canonical-fallback",
  };
}
