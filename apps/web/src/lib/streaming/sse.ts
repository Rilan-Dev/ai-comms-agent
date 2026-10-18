/**
 * Incremental Server-Sent Events reader for fetch() responses.
 *
 * Handles TCP chunks splitting UTF-8 characters, line boundaries, and events.
 * Browser consumers must check event names rather than assuming each read is
 * one model token or that the final HTTP EOF means a completed generation.
 */
export type StreamEvent = { event: string; data: string };

function parseFrame(frame: string): StreamEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim() || "message";
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  return data.length ? { event, data: data.join("\n") } : null;
}

export async function* readSseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let match: RegExpExecArray | null;
      while ((match = /\r?\n\r?\n/.exec(buffer)) !== null) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const event = parseFrame(frame);
        if (event) yield event;
      }
      if (done) break;
      if (buffer.length > 1024 * 1024) {
        throw new Error("The streaming response exceeded the maximum event size.");
      }
    }
    if (buffer.trim()) {
      const last = parseFrame(buffer);
      if (last) yield last;
    }
  } finally {
    reader.releaseLock();
  }
}
