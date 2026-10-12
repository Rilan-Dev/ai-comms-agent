/**
 * packages/db/src/ai-provider/repository.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Repository for the AI provider setup surface:
 *   • ai_provider_configs           — encrypted per-org provider credentials
 *                                     keyed by (organization_id, provider,
 *                                     purpose). `purpose` ∈ {chat, tts, stt,
 *                                     realtime, embedding, general}.
 *   • organization_ai_runtime_settings — org-level defaults for chat / voice-
 *                                     chat / realtime / embedding.
 *   • agent_ai_settings             — per-agent overrides (NULL = inherit org
 *                                     defaults).
 *
 * All credentials are encrypted via the shared security envelope
 * (`packages/db/src/security/envelope.ts`) using CREDENTIALS_MASTER_KEY.
 * Repository callers MUST pass plaintext secrets IN; the repository
 * envelope-encrypts them before INSERT/UPDATE and never returns the
 * ciphertext to the caller. Callers consume the decrypted secret via
 * `getDecryptedProviderConfig()` which performs the decryption in-process.
 */

import { query } from "../client";
import type { AiPurpose } from "@ai-comms-agent/shared";
import {
  decryptCredential,
  encryptCredential,
  parseCredentialsMasterKey,
} from "../security/envelope";

type Row = Record<string, unknown>;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ProviderConfigRow {
  id: string;
  organizationId: string;
  provider: string;
  purpose: AiPurpose;
  model: string | null;
  enabled: boolean;
  baseUrl: string | null;
  /** Never populated on read; only used on write. */
  hasApiKey: boolean;
  /** Decrypted plaintext key — only set in `getDecryptedProviderConfig`. */
  apiKey?: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertProviderConfigInput {
  organizationId: string;
  provider: string;
  purpose: AiPurpose;
  model: string | null;
  baseUrl?: string | null;
  /** Plaintext API key. Empty string = keep current key. */
  apiKey?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface OrgAiRuntimeSettings {
  organizationId: string;
  defaultProvider: string | null;
  knowledgeBaseId: string | null;
  realtimeVoiceProvider: string | null;
  realtimeVoiceModel: string | null;
  voiceId: string | null;
  temperature: number | null;
  maxTokens: number | null;
  systemPrompt: string | null;
  // voice-chat (TTS/STT) — migration 0044
  voiceChatProvider: string | null;
  voiceChatTtsModel: string | null;
  voiceChatSttModel: string | null;
  voiceChatVoiceId: string | null;
  // realtime (separate STT/TTS for Mode B)
  realtimeSttModel: string | null;
  realtimeTtsModel: string | null;
  // embeddings
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  updatedAt: string;
}

export interface UpsertOrgAiRuntimeInput {
  defaultProvider?: string | null;
  knowledgeBaseId?: string | null;
  realtimeVoiceProvider?: string | null;
  realtimeVoiceModel?: string | null;
  voiceId?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  systemPrompt?: string | null;
  voiceChatProvider?: string | null;
  voiceChatTtsModel?: string | null;
  voiceChatSttModel?: string | null;
  voiceChatVoiceId?: string | null;
  realtimeSttModel?: string | null;
  realtimeTtsModel?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  updatedBy?: string | null;
}

export interface AgentAiSettings {
  agentId: string;
  organizationId: string;
  chatProvider: string | null;
  chatModel: string | null;
  voiceChatProvider: string | null;
  voiceChatTtsModel: string | null;
  voiceChatSttModel: string | null;
  voiceChatVoiceId: string | null;
  realtimeVoiceProviderOverride: string | null;
  realtimeSttModel: string | null;
  realtimeTtsModel: string | null;
  realtimeVoiceIdOverride: string | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingDimension: number | null;
  systemPromptOverride: string | null;
  temperatureOverride: number | null;
  maxTokensOverride: number | null;
  updatedAt: string;
}

export interface UpsertAgentAiSettingsInput {
  organizationId: string;
  agentId: string;
  chatProvider?: string | null;
  chatModel?: string | null;
  voiceChatProvider?: string | null;
  voiceChatTtsModel?: string | null;
  voiceChatSttModel?: string | null;
  voiceChatVoiceId?: string | null;
  realtimeVoiceProviderOverride?: string | null;
  realtimeSttModel?: string | null;
  realtimeTtsModel?: string | null;
  realtimeVoiceIdOverride?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingDimension?: number | null;
  systemPromptOverride?: string | null;
  temperatureOverride?: number | null;
  maxTokensOverride?: number | null;
}

// ─── ai_provider_configs CRUD ─────────────────────────────────────────────

/**
 * Lists all provider configs for an org, optionally filtered by purpose.
 * Never returns the encrypted ciphertext — only a `hasApiKey` boolean.
 */
export async function listProviderConfigs(
  organizationId: string,
  purpose?: AiPurpose,
): Promise<ProviderConfigRow[]> {
  const sql = purpose
    ? `SELECT id, organization_id, provider, purpose, model, enabled, config, created_at, updated_at,
              (encrypted_api_key IS NOT NULL) AS has_api_key
         FROM ai_provider_configs
        WHERE organization_id=$1 AND purpose=$2
        ORDER BY provider ASC`
    : `SELECT id, organization_id, provider, purpose, model, enabled, config, created_at, updated_at,
              (encrypted_api_key IS NOT NULL) AS has_api_key
         FROM ai_provider_configs
        WHERE organization_id=$1
        ORDER BY purpose ASC, provider ASC`;
  const params = purpose ? [organizationId, purpose] : [organizationId];
  const r = await query<Row>(sql, params);
  return r.rows.map(rowToProviderConfig);
}

/** Returns a single provider config WITHOUT decrypting the API key. */
export async function getProviderConfig(
  organizationId: string,
  provider: string,
  purpose: AiPurpose,
): Promise<ProviderConfigRow | null> {
  const r = await query<Row>(
    `SELECT id, organization_id, provider, purpose, model, enabled, config, created_at, updated_at,
            (encrypted_api_key IS NOT NULL) AS has_api_key
       FROM ai_provider_configs
      WHERE organization_id=$1 AND provider=$2 AND purpose=$3
      LIMIT 1`,
    [organizationId, provider, purpose],
  );
  return r.rows[0] ? rowToProviderConfig(r.rows[0]) : null;
}

/**
 * Returns a single provider config WITH the API key decrypted.
 * Caller MUST ensure this is only used server-side, never logged.
 */
export async function getDecryptedProviderConfig(
  organizationId: string,
  provider: string,
  purpose: AiPurpose,
): Promise<ProviderConfigRow | null> {
  const r = await query<Row>(
    `SELECT id, organization_id, provider, purpose, model, enabled, config, created_at, updated_at,
            encrypted_api_key
       FROM ai_provider_configs
      WHERE organization_id=$1 AND provider=$2 AND purpose=$3
      LIMIT 1`,
    [organizationId, provider, purpose],
  );
  if (!r.rows[0]) return null;
  const cfg = rowToProviderConfig(r.rows[0]);
  const ciphertext = r.rows[0].encrypted_api_key;
  if (ciphertext && typeof ciphertext !== "undefined" && (ciphertext as Uint8Array).length) {
    try {
      const masterKey = parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY ?? "");
      const buf = Buffer.isBuffer(ciphertext) ? ciphertext : Buffer.from(ciphertext as Uint8Array);
      cfg.apiKey = decryptCredential(buf, masterKey).toString("utf8");
    } catch (err) {
      console.error("[ai-provider] decrypt failed", err);
    }
  }
  return cfg;
}

export async function upsertProviderConfig(
  input: UpsertProviderConfigInput,
): Promise<ProviderConfigRow> {
  const rawKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
  if (!rawKey) throw new Error("CREDENTIALS_MASTER_KEY is not configured.");
  const masterKey = parseCredentialsMasterKey(rawKey);
  // Empty apiKey means "keep current" — caller passed nothing.
  // Non-empty apiKey means "replace" — envelope-encrypt the new value.
  // NULL apiKey on a brand-new row means no key stored (some providers like
  // Sarvam's chat rely on the platform SARVAM_API_KEY env at runtime).
  let encrypted: Buffer | null = null;
  if (input.apiKey && input.apiKey.length > 0) {
    encrypted = encryptCredential(input.apiKey, masterKey);
  }
  const config = input.config ?? {};
  // Stash the base URL inside config so we don't need an extra column.
  const configWithBaseUrl = input.baseUrl
    ? { ...config, baseUrl: input.baseUrl }
    : config;

  // UPSERT by (organization_id, provider, purpose).
  // When apiKey is empty (caller wants to keep current), don't overwrite the
  // encrypted_api_key column — only update model / enabled / config.
  const hasNewKey = encrypted != null;
  const sql = hasNewKey
    ? `INSERT INTO ai_provider_configs (organization_id, provider, purpose, model, enabled, config,
                                        encrypted_api_key, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,now())
       ON CONFLICT (organization_id, provider, purpose)
       DO UPDATE SET model=EXCLUDED.model, enabled=EXCLUDED.enabled, config=EXCLUDED.config,
                     encrypted_api_key=EXCLUDED.encrypted_api_key,
                     updated_at=now()
       RETURNING id, organization_id, provider, purpose, model, enabled, config, created_at, updated_at,
                 (encrypted_api_key IS NOT NULL) AS has_api_key`
    : `INSERT INTO ai_provider_configs (organization_id, provider, purpose, model, enabled, config, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
       ON CONFLICT (organization_id, provider, purpose)
       DO UPDATE SET model=EXCLUDED.model, enabled=EXCLUDED.enabled, config=EXCLUDED.config, updated_at=now()
       RETURNING id, organization_id, provider, purpose, model, enabled, config, created_at, updated_at,
                 (encrypted_api_key IS NOT NULL) AS has_api_key`;
  const params = hasNewKey
    ? [input.organizationId, input.provider, input.purpose, input.model, input.enabled ?? true,
       JSON.stringify(configWithBaseUrl), encrypted]
    : [input.organizationId, input.provider, input.purpose, input.model, input.enabled ?? true,
       JSON.stringify(configWithBaseUrl)];
  const r = await query<Row>(sql, params);
  if (!r.rows[0]) throw new Error("Provider config upsert returned no row.");
  return rowToProviderConfig(r.rows[0]);
}

export async function deleteProviderConfig(
  organizationId: string,
  provider: string,
  purpose: AiPurpose,
): Promise<boolean> {
  const r = await query<Row>(
    `DELETE FROM ai_provider_configs
      WHERE organization_id=$1 AND provider=$2 AND purpose=$3
      RETURNING id`,
    [organizationId, provider, purpose],
  );
  return r.rows.length > 0;
}

// ─── organization_ai_runtime_settings CRUD ────────────────────────────────

const ORG_AI_SETTINGS_COLUMNS = `
  organization_id, default_provider, knowledge_base_id,
  realtime_voice_provider, realtime_voice_model, voice_id,
  temperature, max_tokens, system_prompt,
  voice_chat_provider, voice_chat_tts_model, voice_chat_stt_model, voice_chat_voice_id,
  realtime_stt_model, realtime_tts_model,
  embedding_provider, embedding_model, embedding_dimension,
  updated_at
`;

function rowToOrgAiSettings(r: Row): OrgAiRuntimeSettings {
  return {
    organizationId: String(r.organization_id),
    defaultProvider: r.default_provider ? String(r.default_provider) : null,
    knowledgeBaseId: r.knowledge_base_id != null ? String(r.knowledge_base_id) : null,
    realtimeVoiceProvider: r.realtime_voice_provider ? String(r.realtime_voice_provider) : null,
    realtimeVoiceModel: r.realtime_voice_model ? String(r.realtime_voice_model) : null,
    voiceId: r.voice_id ? String(r.voice_id) : null,
    temperature: r.temperature != null ? Number(r.temperature) : null,
    maxTokens: r.max_tokens != null ? Number(r.max_tokens) : null,
    systemPrompt: r.system_prompt ? String(r.system_prompt) : null,
    voiceChatProvider: r.voice_chat_provider ? String(r.voice_chat_provider) : null,
    voiceChatTtsModel: r.voice_chat_tts_model ? String(r.voice_chat_tts_model) : null,
    voiceChatSttModel: r.voice_chat_stt_model ? String(r.voice_chat_stt_model) : null,
    voiceChatVoiceId: r.voice_chat_voice_id ? String(r.voice_chat_voice_id) : null,
    realtimeSttModel: r.realtime_stt_model ? String(r.realtime_stt_model) : null,
    realtimeTtsModel: r.realtime_tts_model ? String(r.realtime_tts_model) : null,
    embeddingProvider: r.embedding_provider ? String(r.embedding_provider) : null,
    embeddingModel: r.embedding_model ? String(r.embedding_model) : null,
    embeddingDimension: r.embedding_dimension != null ? Number(r.embedding_dimension) : null,
    updatedAt: String(r.updated_at),
  };
}

export async function getOrgAiRuntimeSettings(
  organizationId: string,
): Promise<OrgAiRuntimeSettings | null> {
  const r = await query<Row>(
    `SELECT ${ORG_AI_SETTINGS_COLUMNS}
       FROM organization_ai_runtime_settings
      WHERE organization_id=$1
      LIMIT 1`,
    [organizationId],
  );
  return r.rows[0] ? rowToOrgAiSettings(r.rows[0]) : null;
}

export async function upsertOrgAiRuntimeSettings(
  organizationId: string,
  input: UpsertOrgAiRuntimeInput,
): Promise<OrgAiRuntimeSettings> {
  // Build COALESCE-style update so callers can patch a subset of fields.
  const r = await query<Row>(
    `INSERT INTO organization_ai_runtime_settings
       (organization_id, default_provider, knowledge_base_id,
        realtime_voice_provider, realtime_voice_model, voice_id,
        temperature, max_tokens, system_prompt,
        voice_chat_provider, voice_chat_tts_model, voice_chat_stt_model, voice_chat_voice_id,
        realtime_stt_model, realtime_tts_model,
        embedding_provider, embedding_model, embedding_dimension,
        updated_by, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now())
     ON CONFLICT (organization_id)
     DO UPDATE SET
       default_provider=COALESCE(EXCLUDED.default_provider, organization_ai_runtime_settings.default_provider),
       knowledge_base_id=COALESCE(EXCLUDED.knowledge_base_id, organization_ai_runtime_settings.knowledge_base_id),
       realtime_voice_provider=COALESCE(EXCLUDED.realtime_voice_provider, organization_ai_runtime_settings.realtime_voice_provider),
       realtime_voice_model=COALESCE(EXCLUDED.realtime_voice_model, organization_ai_runtime_settings.realtime_voice_model),
       voice_id=COALESCE(EXCLUDED.voice_id, organization_ai_runtime_settings.voice_id),
       temperature=COALESCE(EXCLUDED.temperature, organization_ai_runtime_settings.temperature),
       max_tokens=COALESCE(EXCLUDED.max_tokens, organization_ai_runtime_settings.max_tokens),
       system_prompt=COALESCE(EXCLUDED.system_prompt, organization_ai_runtime_settings.system_prompt),
       voice_chat_provider=COALESCE(EXCLUDED.voice_chat_provider, organization_ai_runtime_settings.voice_chat_provider),
       voice_chat_tts_model=COALESCE(EXCLUDED.voice_chat_tts_model, organization_ai_runtime_settings.voice_chat_tts_model),
       voice_chat_stt_model=COALESCE(EXCLUDED.voice_chat_stt_model, organization_ai_runtime_settings.voice_chat_stt_model),
       voice_chat_voice_id=COALESCE(EXCLUDED.voice_chat_voice_id, organization_ai_runtime_settings.voice_chat_voice_id),
       realtime_stt_model=COALESCE(EXCLUDED.realtime_stt_model, organization_ai_runtime_settings.realtime_stt_model),
       realtime_tts_model=COALESCE(EXCLUDED.realtime_tts_model, organization_ai_runtime_settings.realtime_tts_model),
       embedding_provider=COALESCE(EXCLUDED.embedding_provider, organization_ai_runtime_settings.embedding_provider),
       embedding_model=COALESCE(EXCLUDED.embedding_model, organization_ai_runtime_settings.embedding_model),
       embedding_dimension=COALESCE(EXCLUDED.embedding_dimension, organization_ai_runtime_settings.embedding_dimension),
       updated_by=EXCLUDED.updated_by,
       updated_at=now()
     RETURNING ${ORG_AI_SETTINGS_COLUMNS}`,
    [
      organizationId,
      input.defaultProvider ?? null,
      input.knowledgeBaseId ?? null,
      input.realtimeVoiceProvider ?? null,
      input.realtimeVoiceModel ?? null,
      input.voiceId ?? null,
      input.temperature ?? null,
      input.maxTokens ?? null,
      input.systemPrompt ?? null,
      input.voiceChatProvider ?? null,
      input.voiceChatTtsModel ?? null,
      input.voiceChatSttModel ?? null,
      input.voiceChatVoiceId ?? null,
      input.realtimeSttModel ?? null,
      input.realtimeTtsModel ?? null,
      input.embeddingProvider ?? null,
      input.embeddingModel ?? null,
      input.embeddingDimension ?? null,
      input.updatedBy ?? null,
    ],
  );
  if (!r.rows[0]) throw new Error("Org AI runtime settings upsert returned no row.");
  return rowToOrgAiSettings(r.rows[0]);
}

// ─── agent_ai_settings CRUD ────────────────────────────────────────────────

const AGENT_AI_COLUMNS = `
  agent_id, organization_id,
  chat_provider, chat_model,
  voice_chat_provider, voice_chat_tts_model, voice_chat_stt_model, voice_chat_voice_id,
  realtime_voice_provider_override, realtime_stt_model, realtime_tts_model, realtime_voice_id_override,
  embedding_provider, embedding_model, embedding_dimension,
  system_prompt_override, temperature_override, max_tokens_override,
  updated_at
`;

function rowToAgentAiSettings(r: Row): AgentAiSettings {
  return {
    agentId: String(r.agent_id),
    organizationId: String(r.organization_id),
    chatProvider: r.chat_provider ? String(r.chat_provider) : null,
    chatModel: r.chat_model ? String(r.chat_model) : null,
    voiceChatProvider: r.voice_chat_provider ? String(r.voice_chat_provider) : null,
    voiceChatTtsModel: r.voice_chat_tts_model ? String(r.voice_chat_tts_model) : null,
    voiceChatSttModel: r.voice_chat_stt_model ? String(r.voice_chat_stt_model) : null,
    voiceChatVoiceId: r.voice_chat_voice_id ? String(r.voice_chat_voice_id) : null,
    realtimeVoiceProviderOverride: r.realtime_voice_provider_override ? String(r.realtime_voice_provider_override) : null,
    realtimeSttModel: r.realtime_stt_model ? String(r.realtime_stt_model) : null,
    realtimeTtsModel: r.realtime_tts_model ? String(r.realtime_tts_model) : null,
    realtimeVoiceIdOverride: r.realtime_voice_id_override ? String(r.realtime_voice_id_override) : null,
    embeddingProvider: r.embedding_provider ? String(r.embedding_provider) : null,
    embeddingModel: r.embedding_model ? String(r.embedding_model) : null,
    embeddingDimension: r.embedding_dimension != null ? Number(r.embedding_dimension) : null,
    systemPromptOverride: r.system_prompt_override ? String(r.system_prompt_override) : null,
    temperatureOverride: r.temperature_override != null ? Number(r.temperature_override) : null,
    maxTokensOverride: r.max_tokens_override != null ? Number(r.max_tokens_override) : null,
    updatedAt: String(r.updated_at),
  };
}

export async function getAgentAiSettings(
  organizationId: string,
  agentId: string,
): Promise<AgentAiSettings | null> {
  const r = await query<Row>(
    `SELECT ${AGENT_AI_COLUMNS}
       FROM agent_ai_settings
      WHERE organization_id=$1 AND agent_id=$2
      LIMIT 1`,
    [organizationId, agentId],
  );
  return r.rows[0] ? rowToAgentAiSettings(r.rows[0]) : null;
}

export async function upsertAgentAiSettings(
  input: UpsertAgentAiSettingsInput,
): Promise<AgentAiSettings> {
  const r = await query<Row>(
    `INSERT INTO agent_ai_settings
       (organization_id, agent_id,
        chat_provider, chat_model,
        voice_chat_provider, voice_chat_tts_model, voice_chat_stt_model, voice_chat_voice_id,
        realtime_voice_provider_override, realtime_stt_model, realtime_tts_model, realtime_voice_id_override,
        embedding_provider, embedding_model, embedding_dimension,
        system_prompt_override, temperature_override, max_tokens_override,
        updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now())
     ON CONFLICT (agent_id)
     DO UPDATE SET
       chat_provider=EXCLUDED.chat_provider,
       chat_model=EXCLUDED.chat_model,
       voice_chat_provider=EXCLUDED.voice_chat_provider,
       voice_chat_tts_model=EXCLUDED.voice_chat_tts_model,
       voice_chat_stt_model=EXCLUDED.voice_chat_stt_model,
       voice_chat_voice_id=EXCLUDED.voice_chat_voice_id,
       realtime_voice_provider_override=EXCLUDED.realtime_voice_provider_override,
       realtime_stt_model=EXCLUDED.realtime_stt_model,
       realtime_tts_model=EXCLUDED.realtime_tts_model,
       realtime_voice_id_override=EXCLUDED.realtime_voice_id_override,
       embedding_provider=EXCLUDED.embedding_provider,
       embedding_model=EXCLUDED.embedding_model,
       embedding_dimension=EXCLUDED.embedding_dimension,
       system_prompt_override=EXCLUDED.system_prompt_override,
       temperature_override=EXCLUDED.temperature_override,
       max_tokens_override=EXCLUDED.max_tokens_override,
       updated_at=now()
     RETURNING ${AGENT_AI_COLUMNS}`,
    [
      input.organizationId, input.agentId,
      input.chatProvider ?? null, input.chatModel ?? null,
      input.voiceChatProvider ?? null, input.voiceChatTtsModel ?? null,
      input.voiceChatSttModel ?? null, input.voiceChatVoiceId ?? null,
      input.realtimeVoiceProviderOverride ?? null, input.realtimeSttModel ?? null,
      input.realtimeTtsModel ?? null, input.realtimeVoiceIdOverride ?? null,
      input.embeddingProvider ?? null, input.embeddingModel ?? null,
      input.embeddingDimension ?? null,
      input.systemPromptOverride ?? null, input.temperatureOverride ?? null,
      input.maxTokensOverride ?? null,
    ],
  );
  if (!r.rows[0]) throw new Error("Agent AI settings upsert returned no row.");
  return rowToAgentAiSettings(r.rows[0]);
}

// ─── helpers ───────────────────────────────────────────────────────────────

function rowToProviderConfig(r: Row): ProviderConfigRow {
  const config = (r.config ?? {}) as Record<string, unknown>;
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    provider: String(r.provider),
    purpose: String(r.purpose) as AiPurpose,
    model: r.model ? String(r.model) : null,
    enabled: Boolean(r.enabled),
    baseUrl: (config.baseUrl as string) ?? null,
    hasApiKey: Boolean(r.has_api_key),
    config,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}
