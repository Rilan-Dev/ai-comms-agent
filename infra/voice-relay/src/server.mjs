import { createServer } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import { handleSarvamRealtimeConnection } from "./sarvam-relay.mjs";
import { handleElevenLabsRealtimeStt, handleElevenLabsRealtimeTts } from "./elevenlabs-relay.mjs";

const port = Number(process.env.VOICE_RELAY_PORT || 3301);
const allowedOrigins = new Set(
  String(process.env.VOICE_RELAY_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
  throw new Error("AUTH_SECRET must be configured with at least 32 characters.");
}
if (!process.env.AI_COMMS_WEB_URL) {
  throw new Error("AI_COMMS_WEB_URL must point to the authenticated ai-comms-agent web application.");
}
if (allowedOrigins.size === 0) {
  throw new Error("VOICE_RELAY_ALLOWED_ORIGINS must list the exact browser origins allowed to open voice sockets.");
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://localhost");
  if (url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
    response.end(JSON.stringify({ ok: true, service: "ai-comms-agent-voice-relay" }));
    return;
  }
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
});

const websocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: 256 * 1024,
  perMessageDeflate: false,
});

const handlers = new Map([
  ["/api/voice/sarvam/realtime", handleSarvamRealtimeConnection],
  ["/api/voice/elevenlabs/realtime", handleElevenLabsRealtimeStt],
  ["/api/voice/elevenlabs/tts-realtime", handleElevenLabsRealtimeTts],
]);

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", "http://localhost");
  const handler = handlers.get(url.pathname);
  const origin = request.headers.origin;
  if (!handler || !origin || !allowedOrigins.has(origin)) {
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit("connection", websocket, request, handler);
  });
});

websocketServer.on("connection", (websocket, request, handler) => {
  Promise.resolve(handler(websocket, request)).catch((error) => {
    console.error("[voice-relay] connection handler failed:", error instanceof Error ? error.message : "unknown error");
    if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
      try { websocket.close(1011, "Voice relay failed"); } catch { websocket.terminate(); }
    }
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[voice-relay] listening on 0.0.0.0:${port}`);
});
