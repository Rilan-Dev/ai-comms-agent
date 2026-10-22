/**
 * Client-side request fence. A pending response is authorized for the agent
 * selected when the request began, not for the agent currently shown. Switching
 * away and back also invalidates the old response through a monotonic version.
 *
 * This does not replace server-side user/mailbox/grant checks.
 */
export type CatchUpScopeToken = Readonly<{ agentId: string; version: number }>;

export class CatchUpRequestScope {
  private agentId: string;
  private version = 0;
  private inFlight = false;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  switchAgent(agentId: string): void {
    if (agentId === this.agentId) return;
    this.agentId = agentId;
    this.version += 1;
    // The old request can finish on the server, but never write into the new
    // view or release the new agent's pending-operation guard.
    this.inFlight = false;
  }

  /** React setBusy schedules a render; handlers need a synchronous lock. */
  isBusy(): boolean {
    return this.inFlight;
  }

  /** Any changed mailbox/window selection makes earlier responses obsolete.
   * This is also safe if a caller explicitly abandons an in-flight request. */
  invalidateSelection(): void {
    this.version += 1;
    this.inFlight = false;
  }

  begin(agentId: string): CatchUpScopeToken | null {
    if (!agentId || agentId !== this.agentId || this.inFlight) return null;
    this.inFlight = true;
    return { agentId, version: this.version };
  }

  isCurrent(token: CatchUpScopeToken): boolean {
    return this.inFlight && token.agentId === this.agentId && token.version === this.version;
  }

  finish(token: CatchUpScopeToken): boolean {
    if (!this.isCurrent(token)) return false;
    this.inFlight = false;
    return true;
  }
}
