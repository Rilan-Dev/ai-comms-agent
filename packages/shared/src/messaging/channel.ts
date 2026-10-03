/**
 * Messaging channel abstraction — provider-neutral.
 * Per docs/architecture/MESSAGING_CHANNEL_ARCHITECTURE.md.
 *
 * Phase 2 scope: interface definition only. Concrete adapters (WhatsApp, etc.)
 * are implemented in Phase 13.
 */

export type MessagingChannelType =
  | "whatsapp"
  | "sms"
  | "telegram"
  | "messenger"
  | "slack"
  | "teams";

export type MessagingCapability =
  | "inbound_webhook"
  | "inbound_poll"
  | "outbound_send"
  | "outbound_template"
  | "contacts"
  | "conversations"
  | "media_inbound"
  | "media_outbound"
  | "status_events"
  | "interactive_messages"
  | "location_inbound"
  | "voice_clip_inbound"
  | "rate_limit_per_number"
  | "template_approval"
  | "24h_window";

export type MessagingCapabilitySet = Record<MessagingCapability, boolean>;

export interface MessagingCredentials {
  system_user_token?: string;
  phone_number_id?: string;
  waba_id?: string;
  verify_token?: string;
  api_key?: string;
  api_secret?: string;
}

export interface InboundWebhookEvent {
  provider_event_id: string;
  contact_target: string;
  message: {
    type: "text" | "media" | "location" | "interactive" | "voice_clip";
    body?: string;
    media_url?: string;
    media_type?: string;
    location?: { latitude: number; longitude: number };
    interactive_payload?: unknown;
  };
  status?: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
}

export interface OutboundMessage {
  type: "text" | "media" | "template";
  body?: string;
  media_url?: string;
  media_type?: "image" | "audio" | "document";
  caption?: string;
  template_name?: string;
  template_language?: string;
  template_parameters?: unknown[];
}

export interface Contact {
  id: string;
  messaging_account_id: string;
  target: string;
  display_name?: string;
  first_seen_at: string;
  last_message_at?: string;
}

export interface Template {
  id: string;
  name: string;
  language: string;
  status: "pending" | "approved" | "rejected";
  parameters?: unknown[];
}

export interface TemplateParams {
  name: string;
  language: string;
  body: string;
  parameters?: unknown[];
}

export interface MessagingChannel {
  readonly channelType: MessagingChannelType;

  connect(credentials: MessagingCredentials): Promise<void>;
  disconnect(): Promise<void>;
  discoverCapabilities(): Promise<MessagingCapabilitySet>;
  capabilities(): MessagingCapabilitySet;

  parseWebhookEvent(rawEvent: unknown, signature: string): InboundWebhookEvent;

  send(target: string, message: OutboundMessage): Promise<{ providerMessageId: string }>;
  sendTemplate(
    target: string,
    templateName: string,
    languageCode: string,
    parameters: unknown[],
  ): Promise<{ providerMessageId: string }>;

  listContacts?(): Promise<Contact[]>;
  getContact?(target: string): Promise<Contact | null>;

  listTemplates?(): Promise<Template[]>;
  submitTemplate?(params: TemplateParams): Promise<{ templateId: string }>;

  signatureHeader(): string;
}
