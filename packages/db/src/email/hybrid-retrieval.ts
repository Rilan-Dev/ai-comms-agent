import { query } from "../client";

export type EmailVectorCandidate = {
  orgId: string;
  accountId: string;
  messageId: string;
  sourceId?: string;
  score: number;
};

export type EmailVectorSearch = (input: {
  orgId: string;
  allowedAccountIds: string[];
  query: string;
  limit: number;
}) => Promise<EmailVectorCandidate[]>;

export type EmailHybridSearchInput = {
  organizationId: string;
  agentId: string;
  query: string;
  accountIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  sender?: string;
  subject?: string;
  limit?: number;
};

export type EmailHybridSource = {
  citation: string;
  messageId: string;
  providerMessageId: string;
  accountId: string;
  mailbox: string;
  provider: string;
  threadId: string | null;
  from: string;
  to: unknown;
  subject: string;
  receivedAt: string | null;
  snippet: string;
  score: number;
  matchedBy: Array<"lexical" | "semantic">;
};

export type EmailHybridSearchResult = {
  sources: EmailHybridSource[];
  allowedAccountCount: number;
  retrieval: "hybrid" | "lexical_fallback";
  degraded: boolean;
  completeness: "bounded";
  note?: string;
};

type DbRow = Record<string, unknown>;
type QueryFn = typeof query;

function boundedLimit(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(25, Math.max(1, Math.floor(value)))
    : 8;
}

function validDate(value: string | undefined, field: string): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`Invalid ${field} timestamp.`);
  return new Date(time).toISOString();
}

/**
 * Shared, server-side hybrid retrieval core for chat and realtime voice.
 *
 * Authorization is resolved from persisted agent_email_accounts bindings on
 * every call. Callers cannot supply an authoritative account allowlist.
 * Qdrant/Clara only returns candidate pointers; every candidate is reloaded
 * from PostgreSQL under the same organization, agent, account, and date scope.
 *
 * This module is deliberately not connected to a transport until FIX-01 closes
 * ISS-026 and the host authorization boundary is verified.
 */
export function createEmailHybridRetriever(dependencies: {
  vectorSearch: EmailVectorSearch;
  query?: QueryFn;
}) {
  const runQuery: QueryFn = dependencies.query ?? query;

  return async function searchEmailHybrid(input: EmailHybridSearchInput): Promise<EmailHybridSearchResult> {
    const organizationId = input.organizationId.trim();
    const agentId = input.agentId.trim();
    const queryText = input.query.trim().slice(0, 500);
    if (!organizationId || !agentId) throw new Error("A trusted organization and agent context is required.");
    if (!queryText) throw new Error("An email search query is required.");

    const dateFrom = validDate(input.dateFrom, "dateFrom");
    const dateTo = validDate(input.dateTo, "dateTo");
    if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
      throw new Error("dateFrom must be earlier than or equal to dateTo.");
    }

    const bindings = await runQuery<{ account_id: string }>(
      `SELECT a.id AS account_id
         FROM agent_email_accounts b
         JOIN agents g ON g.id=b.agent_id AND g.organization_id=$1
         JOIN email_accounts a ON a.id=b.email_account_id AND a.organization_id=$1
        WHERE b.agent_id=$2
          AND a.deleted_at IS NULL
          AND a.status='connected'
          AND b.role IN ('primary','read_only')
        ORDER BY a.id`,
      [organizationId, agentId],
    );
    const boundIds = [...new Set(bindings.rows.map((row) => String(row.account_id)).filter(Boolean))];
    const requestedIds = input.accountIds === undefined
      ? null
      : new Set(input.accountIds.map((id) => id.trim()).filter(Boolean));
    const allowedAccountIds = requestedIds
      ? boundIds.filter((id) => requestedIds.has(id))
      : boundIds;
    if (!allowedAccountIds.length) {
      return { sources: [], allowedAccountCount: 0, retrieval: "lexical_fallback", degraded: false, completeness: "bounded" };
    }

    const limit = boundedLimit(input.limit);
    const values: unknown[] = [organizationId, agentId, allowedAccountIds, `%${queryText.replace(/[\\%_]/g, "\\$&")}%`];
    const conditions = [
      "m.organization_id=$1",
      "a.organization_id=$1",
      "g.organization_id=$1",
      "b.agent_id=$2",
      "m.email_account_id = ANY($3::uuid[])",
      "m.email_account_id=b.email_account_id",
      "a.id=m.email_account_id",
      "a.deleted_at IS NULL",
      "a.status='connected'",
      "b.role IN ('primary','read_only')",
      "m.is_draft=false",
      "(m.subject ILIKE $4 ESCAPE E'\\\\' OR COALESCE(m.text_body,'') ILIKE $4 ESCAPE E'\\\\' OR COALESCE(m.from_email,'') ILIKE $4 ESCAPE E'\\\\' OR COALESCE(m.snippet,'') ILIKE $4 ESCAPE E'\\\\')",
    ];
    const add = (condition: (index: number) => string, value: unknown) => {
      values.push(value);
      conditions.push(condition(values.length));
    };
    if (dateFrom) add((n) => `m.received_at >= $${n}::timestamptz`, dateFrom);
    if (dateTo) add((n) => `m.received_at <= $${n}::timestamptz`, dateTo);
    if (input.sender?.trim()) add((n) => `m.from_email ILIKE $${n} ESCAPE E'\\\\'`, `%${input.sender.trim().slice(0, 320).replace(/[\\%_]/g, "\\$&")}%`);
    if (input.subject?.trim()) add((n) => `m.subject ILIKE $${n} ESCAPE E'\\\\'`, `%${input.subject.trim().slice(0, 300).replace(/[\\%_]/g, "\\$&")}%`);
    values.push(limit);
    const lexicalPromise = runQuery<DbRow>(
      `SELECT m.id, m.provider_message_id, m.email_account_id, m.thread_id,
              m.from_email, m.to_recipients, m.subject, m.text_body, m.snippet,
              m.received_at, a.email_address, a.provider
         FROM email_messages m
         JOIN email_accounts a ON a.id=m.email_account_id
         JOIN agent_email_accounts b ON b.email_account_id=a.id
         JOIN agents g ON g.id=b.agent_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY m.received_at DESC NULLS LAST
        LIMIT $${values.length}`,
      values,
    );

    const vectorPromise = dependencies.vectorSearch({
      orgId: organizationId,
      allowedAccountIds,
      query: queryText,
      limit: Math.min(50, limit * 4),
    }).then(
      (hits) => ({ hits, failed: false }),
      () => ({ hits: [] as EmailVectorCandidate[], failed: true }),
    );
    const [lexical, vectorResult] = await Promise.all([lexicalPromise, vectorPromise]);
    const vectorHits = vectorResult.hits;
    const vectorFailed = vectorResult.failed;

    type Candidate = { accountId: string; providerMessageId: string; score: number; matchedBy: Set<"lexical" | "semantic"> };
    const candidates = new Map<string, Candidate>();
    const addCandidate = (accountId: string, providerMessageId: string, score: number, method: "lexical" | "semantic") => {
      if (!accountId || !providerMessageId || !allowedAccountIds.includes(accountId)) return;
      const key = `${accountId}\\0${providerMessageId}`;
      const prior = candidates.get(key);
      if (prior) {
        prior.score = Math.max(prior.score, score);
        prior.matchedBy.add(method);
      } else {
        candidates.set(key, { accountId, providerMessageId, score, matchedBy: new Set([method]) });
      }
    };
    lexical.rows.forEach((row, index) => addCandidate(String(row.email_account_id), String(row.provider_message_id), 1 / (index + 1), "lexical"));
    for (const hit of vectorHits) {
      if (hit.orgId !== organizationId || !allowedAccountIds.includes(hit.accountId)) continue;
      addCandidate(hit.accountId, hit.messageId, Math.max(0, Math.min(1, hit.score)), "semantic");
    }
    if (!candidates.size) {
      return {
        sources: [],
        allowedAccountCount: allowedAccountIds.length,
        retrieval: vectorFailed ? "lexical_fallback" : "hybrid",
        degraded: vectorFailed,
        completeness: "bounded",
        ...(vectorFailed ? { note: "Semantic retrieval was unavailable; results may be incomplete." } : {}),
      };
    }

    const candidateJson = JSON.stringify([...candidates.values()].map((candidate) => ({
      account_id: candidate.accountId,
      provider_message_id: candidate.providerMessageId,
      score: candidate.score,
      matched_by: [...candidate.matchedBy],
    })));
    const finalValues: unknown[] = [organizationId, agentId, allowedAccountIds, candidateJson];
    const finalConditions = [
      "m.organization_id=$1",
      "a.organization_id=$1",
      "g.organization_id=$1",
      "b.agent_id=$2",
      "m.email_account_id = ANY($3::uuid[])",
      "m.email_account_id=b.email_account_id",
      "a.id=m.email_account_id",
      "a.deleted_at IS NULL",
      "a.status='connected'",
      "b.role IN ('primary','read_only')",
      "m.is_draft=false",
    ];
    const finalAdd = (condition: (index: number) => string, value: unknown) => {
      finalValues.push(value);
      finalConditions.push(condition(finalValues.length));
    };
    if (dateFrom) finalAdd((n) => `m.received_at >= $${n}::timestamptz`, dateFrom);
    if (dateTo) finalAdd((n) => `m.received_at <= $${n}::timestamptz`, dateTo);
    if (input.sender?.trim()) finalAdd((n) => `m.from_email ILIKE $${n} ESCAPE E'\\\\'`, `%${input.sender.trim().slice(0, 320).replace(/[\\%_]/g, "\\$&")}%`);
    if (input.subject?.trim()) finalAdd((n) => `m.subject ILIKE $${n} ESCAPE E'\\\\'`, `%${input.subject.trim().slice(0, 300).replace(/[\\%_]/g, "\\$&")}%`);
    finalValues.push(limit);
    const finalRows = await runQuery<DbRow>(
      `WITH candidates AS (
         SELECT account_id, provider_message_id, score, matched_by
           FROM jsonb_to_recordset($4::jsonb)
             AS c(account_id uuid, provider_message_id text, score double precision, matched_by text[])
       )
       SELECT m.id, m.provider_message_id, m.email_account_id, m.thread_id,
              m.from_email, m.to_recipients, m.subject, m.text_body, m.snippet,
              m.received_at, a.email_address, a.provider, c.score, c.matched_by
         FROM candidates c
         JOIN email_messages m ON m.email_account_id=c.account_id AND m.provider_message_id=c.provider_message_id
         JOIN email_accounts a ON a.id=m.email_account_id
         JOIN agent_email_accounts b ON b.email_account_id=a.id
         JOIN agents g ON g.id=b.agent_id
        WHERE ${finalConditions.join(" AND ")}
        ORDER BY c.score DESC, m.received_at DESC NULLS LAST
        LIMIT $${finalValues.length}`,
      finalValues,
    );

    const sources: EmailHybridSource[] = finalRows.rows.map((row) => {
      const messageId = String(row.id);
      const subject = typeof row.subject === "string" && row.subject ? row.subject : "(no subject)";
      const body = typeof row.text_body === "string" && row.text_body ? row.text_body : String(row.snippet ?? "");
      return {
        citation: `email:${messageId}`,
        messageId,
        providerMessageId: String(row.provider_message_id),
        accountId: String(row.email_account_id),
        mailbox: String(row.email_address),
        provider: String(row.provider),
        threadId: row.thread_id == null ? null : String(row.thread_id),
        from: String(row.from_email ?? ""),
        to: row.to_recipients ?? [],
        subject,
        receivedAt: row.received_at == null ? null : new Date(String(row.received_at)).toISOString(),
        snippet: body.slice(0, 1600),
        score: Number(row.score ?? 0),
        matchedBy: Array.isArray(row.matched_by)
          ? row.matched_by.filter((value): value is "lexical" | "semantic" => value === "lexical" || value === "semantic")
          : [],
      };
    });
    return {
      sources,
      allowedAccountCount: allowedAccountIds.length,
      retrieval: vectorFailed ? "lexical_fallback" : "hybrid",
      degraded: vectorFailed,
      completeness: "bounded",
      ...(vectorFailed ? { note: "Semantic retrieval was unavailable; results may be incomplete." } : {}),
    };
  };
}
