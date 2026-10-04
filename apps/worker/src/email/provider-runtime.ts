import {
  CapabilityNotSupported,
  type EmailCredentials,
  type EmailProvider,
  type EmailProviderCapability,
  type EmailProviderType,
} from "@ai-comms-agent/shared";
import { EmailProviderRegistry } from "@ai-comms-agent/shared";

export interface ProviderSession {
  provider: EmailProvider;
  capabilities: ReturnType<EmailProvider["capabilities"]>;
}

export class EmailProviderRuntime {
  constructor(private readonly registry: EmailProviderRegistry) {}

  async connect(
    providerId: EmailProviderType,
    credentials: EmailCredentials,
  ): Promise<ProviderSession> {
    const provider = this.registry.create(providerId);
    await provider.connect(credentials);
    const capabilities = await provider.discoverCapabilities();
    return { provider, capabilities };
  }

  requireCapability(
    session: ProviderSession,
    capability: EmailProviderCapability,
  ): void {
    if (!session.capabilities[capability]) {
      throw new CapabilityNotSupported(session.provider.providerId, capability);
    }
  }

  async sync(session: ProviderSession, state: Parameters<EmailProvider["sync"]>[0]) {
    this.requireCapability(session, state.sync_mode === "initial" ? "sync_full" : "sync_incremental");
    return session.provider.sync(state);
  }

  async createDraft(
    session: ProviderSession,
    params: Parameters<EmailProvider["createDraft"]>[0],
  ) {
    this.requireCapability(session, "drafts");
    return session.provider.createDraft(params);
  }

  async send(session: ProviderSession, draftId: string) {
    this.requireCapability(session, "send");
    return session.provider.send(draftId);
  }

  async markRead(session: ProviderSession, ids: string[], isRead: boolean) {
    this.requireCapability(session, "mark_read");
    return session.provider.markRead(ids, isRead);
  }

  async archive(session: ProviderSession, ids: string[]) {
    this.requireCapability(session, "archive");
    return session.provider.archive(ids);
  }

  async move(session: ProviderSession, ids: string[], folderId: string) {
    this.requireCapability(session, "move");
    return session.provider.move(ids, folderId);
  }
}
