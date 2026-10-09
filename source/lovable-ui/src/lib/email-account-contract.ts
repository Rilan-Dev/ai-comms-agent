import { z } from "zod";

/**
 * Browser-safe email account contracts.
 *
 * These schemas intentionally contain no credential/token fields. Provider secrets,
 * OAuth tokens, and mailbox passwords belong only in server-side credential storage.
 */
export const emailProviderSchema = z.enum(["gmail", "zoho", "imap_smtp", "microsoft_graph"]);
export const emailConnectionStatusSchema = z.enum([
  "pending",
  "connected",
  "error",
  "disconnected",
  "revoked",
]);

export const emailAccountSummarySchema = z
  .object({
    id: z.string().min(1),
    organizationId: z.string().min(1),
    provider: emailProviderSchema,
    emailAddress: z.string().email(),
    displayName: z.string().nullable().optional(),
    status: emailConnectionStatusSchema,
    lastSyncAt: z.string().datetime().nullable().optional(),
    lastError: z.string().max(500).nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const listEmailAccountsInputSchema = z
  .object({
    organizationId: z.string().min(1).max(128),
  })
  .strict();

export const emailAccountActionInputSchema = z
  .object({
    organizationId: z.string().min(1).max(128),
    accountId: z.string().min(1).max(128).optional(),
    action: z.enum([
      "disconnect",
      "connect_imap_smtp",
      "test_imap_smtp",
      "reconnect_imap_smtp",
    ]),
  })
  .strict();

export type EmailProvider = z.infer<typeof emailProviderSchema>;
export type EmailConnectionStatus = z.infer<typeof emailConnectionStatusSchema>;
export type EmailAccountSummary = z.infer<typeof emailAccountSummarySchema>;
export type ListEmailAccountsInput = z.infer<typeof listEmailAccountsInputSchema>;
export type EmailAccountActionInput = z.infer<typeof emailAccountActionInputSchema>;
