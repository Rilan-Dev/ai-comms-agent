export type VoiceTransportState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "failed";

export type VoiceTranscriptEvent =
  | { type: "transcript.partial"; sequence: number; text: string }
  | { type: "transcript.final"; sequence: number; text: string }
  | { type: "assistant.text"; sequence: number; text: string }
  | { type: "transport.error"; sequence: number; message: string };

export interface VoiceTransportSession {
  sessionId: string;
  endpoint: string;
  provider: string | null;
  model: string | null;
  voiceId: string | null;
}

export interface VoiceTransportAdapter {
  connect(session: VoiceTransportSession): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  sendTranscript(text: string, sequence: number): Promise<void>;
  onEvent(listener: (event: VoiceTranscriptEvent) => void): () => void;
  getState(): VoiceTransportState;
}

/**
 * Only the newest turn may update the browser voice surface.
 * This mirrors Clara's stale-generation safety without reimplementing Clara's
 * provider generation coordinator.
 */
export function isCurrentVoiceSequence(current: number, incoming: number): boolean {
  return incoming === current;
}
