import { createHmac, timingSafeEqual } from "node:crypto";
import { decryptCredential, parseCredentialsMasterKey, query } from "@ai-comms-agent/db";

export type RelayProvider = "sarvam" | "elevenlabs";

export function mintVoiceRelayToken(input: {
  organizationId: string;
  agentId: string;
  sessionId: string;
  userId: string;
  languageCode?: string;
}): { token: string; expiresAt: string } {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters for voice relay tokens.");
  const language = (input.languageCode || "en-IN").slice(0, 20);
  const kbId = [input.agentId, input.sessionId, input.userId, language].join("~");
  if ([input.organizationId, input.agentId, input.sessionId, input.userId].some((value) => !value || value.includes(".") || value.includes("~"))) {
    throw new Error("Voice relay token claims contain an invalid identifier.");
  }
  const expiresAtMs = Date.now() + 5 * 60_000;
  const payload = `v1.${expiresAtMs}.${kbId}.${input.organizationId}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return { token: `${payload}.${signature}`, expiresAt: new Date(expiresAtMs).toISOString() };
}

export function buildVoiceRelayUrl(path: string, token: string): string | null {
  const base = process.env.VOICE_RELAY_PUBLIC_URL?.trim();
  if (!base) return null;
  try {
    const url = new URL(path, base.endsWith("/") ? base : `${base}/`);
    if (url.protocol === "https:") url.protocol = "wss:";
    else if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol !== "wss:" && url.protocol !== "ws:") return null;
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return null;
  }
}

export function verifyVoiceRelayRequest(request: Request, headerName: string, payload: string): boolean {
  const secret = process.env.AUTH_SECRET?.trim();
  const supplied = request.headers.get(headerName)?.trim() ?? "";
  if (!secret || secret.length < 32 || !/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(supplied, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function decodeVoiceRelayClaims(value: unknown): {
  agentId: string;
  sessionId: string;
  userId: string;
  languageCode: string;
} | null {
  if (typeof value !== "string") return null;
  const [agentId, sessionId, userId, languageCode, ...extra] = value.split("~");
  if (!agentId || !sessionId || !userId || !languageCode || extra.length) return null;
  if ([agentId, sessionId, userId].some((item) => item.includes(".") || item.length > 200)) return null;
  const allowedLanguages = new Set(["en-IN", "ta-IN", "hi-IN", "bn-IN", "te-IN", "kn-IN", "ml-IN", "mr-IN", "gu-IN", "pa-IN", "od-IN"]);
  return { agentId, sessionId, userId, languageCode: allowedLanguages.has(languageCode) ? languageCode : "en-IN" };
}

export async function resolveVoiceProviderApiKey(organizationId: string, provider: RelayProvider): Promise<string | null> {
  const saved = await query<{ encrypted_api_key: Buffer | null; enabled: boolean }>(
    "SELECT encrypted_api_key, enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose IN ('realtime','stt','tts','chat','general') ORDER BY CASE WHEN purpose='realtime' THEN 0 WHEN purpose='stt' THEN 1 WHEN purpose='tts' THEN 2 WHEN purpose='chat' THEN 3 ELSE 4 END LIMIT 1",
    [organizationId, provider],
  );
  const row = saved.rows[0];
  if (row?.enabled && row.encrypted_api_key?.length) {
    const masterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!masterKey) throw new Error("CREDENTIALS_MASTER_KEY is required to decrypt the organization's voice credential.");
    return decryptCredential(Buffer.from(row.encrypted_api_key), parseCredentialsMasterKey(masterKey)).toString("utf8");
  }
  return provider === "sarvam"
    ? process.env.SARVAM_API_KEY?.trim() || null
    : process.env.ELEVENLABS_API_KEY?.trim() || null;
}
